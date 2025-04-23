import { css } from '@emotion/css';
import { saveAs } from 'file-saver';
import { useCallback, useState } from 'react';

import { Button, ClipboardButton, HorizontalGroup, TextArea, Stack, TextLink } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { SaveDashboardFormProps } from '../types';

export const SaveProvisionedDashboardForm = ({ dashboard, onCancel }: Omit<SaveDashboardFormProps, 'isLoading'>) => {
  const [dashboardJSON, setDashboardJson] = useState(() => {
    const clone = dashboard.getSaveModelClone();
    delete clone.id;
    return JSON.stringify(clone, null, 2);
  });

  const saveToFile = useCallback(() => {
    const blob = new Blob([dashboardJSON], {
      type: 'application/json;charset=utf-8',
    });
    saveAs(blob, dashboard.title + '-' + new Date().getTime() + '.json');
  }, [dashboard.title, dashboardJSON]);

  return (
    <>
      <Stack direction="column" gap={2}>
        <div>
          <Trans i18nKey="dashboard.save-provisioned-dashboard-form.cannot-be-saved">
            This dashboard cannot be saved from the Grafana UI because it has been provisioned from another source. Copy
            the JSON or save it to a file below, then you can update your dashboard in the provisioning source.
          </Trans>
          <br />
          <i>
            <Trans i18nKey="dashboard.save-provisioned-dashboard-form.see-docs">
              See{' '}
              <TextLink href="https://grafana.com/docs/grafana/latest/administration/provisioning/#dashboards" external>
                documentation
              </TextLink>{' '}
              for more information about provisioning.
            </Trans>
          </i>
          <br /> <br />
          <Trans
            i18nKey="dashboard.save-provisioned-dashboard-form.file-path"
            values={{ filePath: dashboard.meta.provisionedExternalId }}
          >
            <strong>File path:</strong> {'{{filePath}}'}
          </Trans>
        </div>
        <TextArea
          spellCheck={false}
          value={dashboardJSON}
          onChange={(e) => {
            setDashboardJson(e.currentTarget.value);
          }}
          className={styles.json}
        />
        <HorizontalGroup>
          <Button variant="secondary" onClick={onCancel} fill="outline">
            <Trans i18nKey="dashboard.save-provisioned-dashboard-form.cancel">Cancel</Trans>
          </Button>
          <ClipboardButton icon="copy" getText={() => dashboardJSON}>
            <Trans i18nKey="dashboard.save-provisioned-dashboard-form.copy-json-to-clipboard">
              Copy JSON to clipboard
            </Trans>
          </ClipboardButton>
          <Button type="submit" onClick={saveToFile}>
            <Trans i18nKey="dashboard.save-provisioned-dashboard-form.save-json-to-file">Save JSON to file</Trans>
          </Button>
        </HorizontalGroup>
      </Stack>
    </>
  );
};

const styles = {
  json: css({
    height: '400px',
    width: '100%',
    overflow: 'auto',
    resize: 'none',
    fontFamily: 'monospace',
  }),
};
