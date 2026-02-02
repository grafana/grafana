import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { FC, memo, useCallback, useEffect, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, ButtonGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { appEvents } from 'app/core/core';
import { t, Trans } from 'app/core/internationalization';
import { LANGUAGES } from 'app/core/internationalization/constants';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { LocaleKeyManagement } from './LocaleKeyManagement';
import { DashboardLocale, initializeGlobalLocale } from './types';

interface LocaleDiff {
  [key: string]: {
    add: { [key: string]: string };
    remove: string[];
  };
}

interface ImportedLocales {
  [key: string]: { [key: string]: string };
}

const validateImportedData = (data: any): data is ImportedLocales => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON format: root must be an object');
  }

  // Check each language code and its translations
  for (const [langCode, translations] of Object.entries(data)) {
    // Validate language code is one of the allowed locales
    const validLanguageCodes = LANGUAGES.map((i) => i.code);
    if (!validLanguageCodes.includes(langCode)) {
      //BMC change
      throw new Error(t('bmc.content-localization','Invalid language code: {{langCode}}', {langCode}));
    }

    // Validate translations object
    if (!translations || typeof translations !== 'object') {
      throw new Error(`Invalid translations for language ${langCode}: must be an object`);
    }

    // Validate each translation is a string
    for (const [key, value] of Object.entries(translations)) {
      if (typeof value !== 'string') {
        throw new Error(`Invalid translation for key "${key}" in ${langCode}: value must be a string`);
      }
    }
  }

  return true;
};

export const GlobalLocales: FC<GrafanaRouteComponentProps> = memo(() => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [locales, setLocales] = useState<DashboardLocale>(initializeGlobalLocale());
  const [originalLocales, setOriginalLocales] = useState<DashboardLocale>(initializeGlobalLocale());

  // Fetch global locales on component mount
  useEffect(() => {
    fetchGlobalLocales();
  }, []);

  const fetchGlobalLocales = async () => {
    try {
      const response = await getBackendSrv().get('/api/localization/global');
      if (response) {
        setLocales(cloneDeep(response));
        setOriginalLocales(response);
      }
    } catch (error) {
      console.error('Error fetching global locales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a mock dashboard object with required methods
  const mockDashboard = {
    getDashLocales: useCallback(() => locales, [locales]),
    updateLocalesChanges: useCallback((newLocales: DashboardLocale) => {
      setLocales(newLocales);
    }, []),
    // Add any other required dashboard properties here
  };

  // Function to check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(locales) !== JSON.stringify(originalLocales);
  }, [locales, originalLocales]);

  const generateDiffPayload = useCallback((): LocaleDiff => {
    const diff: LocaleDiff = {};

    // Process each language code
    Object.keys(locales).forEach((langCode) => {
      const currentLocale = locales[langCode as keyof DashboardLocale];
      const originalLocale = originalLocales[langCode as keyof DashboardLocale];

      const added: { [key: string]: string } = {};
      const removed: string[] = [];

      // Find added or modified keys
      Object.entries(currentLocale).forEach(([key, value]) => {
        if (!originalLocale.hasOwnProperty(key) || originalLocale[key] !== value) {
          added[key] = value;
        }
      });

      // Find removed keys
      Object.keys(originalLocale).forEach((key) => {
        if (!currentLocale.hasOwnProperty(key)) {
          removed.push(key);
        }
      });

      // Only add language to diff if there are changes
      if (Object.keys(added).length > 0 || removed.length > 0) {
        diff[langCode] = {
          add: added,
          remove: removed,
        };
      }
    });

    return diff;
  }, [locales, originalLocales]);

  // Updated save changes function
  const saveChanges = useCallback(async () => {
    setSaving(true);
    try {
      const diffPayload = generateDiffPayload();
      await getBackendSrv().post('/api/localization/global', diffPayload);
      window.location.reload();
    } catch (error) {
      console.error('Error saving global locales:', error);
      // Handle error (show notification, etc.)
    } finally {
      setSaving(false);
    }
  }, [generateDiffPayload]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);

        // Validate the imported data structure
        if (validateImportedData(importedData)) {
          // Create new locales object with imported data
          const newLocales = Object.keys(importedData).reduce((acc: any, cur: string) => {
            acc[cur] = { add: importedData[cur] };
            return acc;
          }, {});
          await getBackendSrv().post('/api/localization/global', newLocales);
          window.location.reload();
        }
      } catch (error) {
        console.error('Error processing imported file:', error);
        appEvents.emit(AppEvents.alertError, [(error as Error).message]);
      } finally {
        setSaving(false);
      }
    };
    reader.onerror = () => {
      appEvents.emit(AppEvents.alertError, ['Error reading file']);
      setSaving(false);
    };
    reader.readAsText(file);
  }, []);

  const handleExport = useCallback(() => {
    try {
      const dataStr = JSON.stringify(locales);
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
      const downloadLink = document.createElement('a');
      const href = window.URL.createObjectURL(blob);

      downloadLink.setAttribute('href', href);
      downloadLink.setAttribute('target', '_self');
      downloadLink.setAttribute('download', `global-locales.json`);

      // Required for Firefox
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      // Clean up the URL object
      setTimeout(() => {
        window.URL.revokeObjectURL(href);
      }, 100);
    } catch (error) {
      console.error('Error exporting file:', error);
      appEvents.emit(AppEvents.alertError, ['Failed to export locales']);
    }
  }, [locales]);

  const ControlOptions = useCallback(() => {
    return (
      <>
        <ButtonGroup>
          <Button icon="download-alt" onClick={handleExport}>
            <Trans i18nKey="bmc.manage-locales.export">Export</Trans>
          </Button>
          <div style={{ display: 'inline-block' }}>
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
              onClick={(e) => {
                // Reset file input
                (e.target as HTMLInputElement).value = '';
              }}
              id="import-json-input"
            />
            <Button
              className={css`
                margin-left: 10px;
              `}
              icon="import"
              disabled={isSaving}
              onClick={() => {
                document.getElementById('import-json-input')?.click();
              }}
            >
              <Trans i18nKey="bmc.manage-locales.import">Import</Trans>
            </Button>
          </div>
          <Button
            disabled={!hasUnsavedChanges() || isSaving}
            className={css`
              margin-left: 10px;
            `}
            onClick={saveChanges}
          >
            <Trans i18nKey="bmc.manage-locales.save">Save</Trans>
          </Button>
        </ButtonGroup>
      </>
    );
  }, [hasUnsavedChanges, handleExport, handleImport, saveChanges, isSaving]);

  return (
    <Page navId="global-locales">
      <Page.Contents isLoading={isLoading}>
        <LocaleKeyManagement
          dashboard={mockDashboard}
          globalMode={true}
          defaultKey="en-US"
          ControlOption={ControlOptions}
          MAX_KEY_LENGTH={100}
        />
      </Page.Contents>
    </Page>
  );
});

GlobalLocales.displayName = 'GlobalLocales';

export default GlobalLocales;
