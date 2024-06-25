import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, ClipboardButton, CodeEditor, Label, Spinner, Stack, Switch, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { ShareExportTab } from '../ShareExportTab';

const selector = e2eSelectors.pages.ExportDashboardDrawer.ExportAsJson;

export class ExportAsJson extends ShareExportTab {
  static Component = ExportAsJsonRenderer;
}

function ExportAsJsonRenderer({ model }: SceneComponentProps<ExportAsJson>) {
  const styles = useStyles2(getStyles);

  const { isSharingExternally, dashboardRef } = model.useState();

  const onCancelClick = () => {
    dashboardRef.resolve().closeModal();
  };

  const dashboardJson = useAsync(async () => {
    const json = await model.getExportableDashboardJson();
    return JSON.stringify(json, null, 2);
  }, [isSharingExternally]);

  return (
    <>
      <p>
        <Trans i18nKey="export.json.info-text">
          Copy or download a JSON file containing the JSON of your dashboard
        </Trans>
      </p>
      <Stack gap={1} alignItems="center">
        <Switch
          data-testid={selector.exportExternallyToggle}
          id="export-externally-toggle"
          value={isSharingExternally}
          onChange={model.onShareExternallyChange}
        />
        <Label>
          <Trans i18nKey="export.json.export-externally-label">Export the dashboard to use in another instance</Trans>
        </Label>
      </Stack>
      <AutoSizer disableHeight className={styles.codeEditorBox} data-testid={selector.codeEditor}>
        {({ width }) => {
          if (dashboardJson.value) {
            return (
              <CodeEditor
                value={dashboardJson.value}
                language="json"
                showMiniMap={false}
                height="500px"
                width={width}
                readOnly={true}
              />
            );
          }

          return dashboardJson.loading && <Spinner />;
        }}
      </AutoSizer>
      <div className={styles.container}>
        <Stack gap={1} flex={1} direction={{ xs: 'column', sm: 'row' }}>
          <Button
            data-testid={selector.saveToFileButton}
            variant="primary"
            icon="download-alt"
            onClick={model.onSaveAsFile}
          >
            <Trans i18nKey="export.json.download-button">Download file</Trans>
          </Button>
          <ClipboardButton
            data-testid={selector.copyToClipboardButton}
            variant="secondary"
            icon="copy"
            disabled={dashboardJson.loading}
            getText={() => dashboardJson.value ?? ''}
          >
            <Trans i18nKey="export.json.copy-button">Copy to clipboard</Trans>
          </ClipboardButton>
          <Button data-testid={selector.cancelButton} variant="secondary" onClick={onCancelClick} fill="outline">
            <Trans i18nKey="export.json.cancel-button">Cancel</Trans>
          </Button>
        </Stack>
      </div>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    codeEditorBox: css({
      margin: `${theme.spacing(2)} 0`,
    }),
    container: css({
      paddingBottom: theme.spacing(2),
    }),
  };
}
