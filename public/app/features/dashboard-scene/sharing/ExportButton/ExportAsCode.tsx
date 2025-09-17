import { css } from '@emotion/css';
import yaml from 'js-yaml';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Button, ClipboardButton, CodeEditor, Label, Spinner, Stack, Switch, useStyles2 } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

import { ShareExportTab } from '../ShareExportTab';

import { ExportMode, ResourceExport } from './ResourceExport';

const selector = e2eSelectors.pages.ExportDashboardDrawer.ExportAsJson;

export class ExportAsCode extends ShareExportTab {
  static Component = ExportAsCodeRenderer;

  public getTabLabel(): string {
    return t('export.json.title', 'Export dashboard');
  }
}

function ExportAsCodeRenderer({ model }: SceneComponentProps<ExportAsCode>) {
  const styles = useStyles2(getStyles);
  const { isSharingExternally, isViewingYAML, exportMode } = model.useState();

  const dashboardJson = useAsync(async () => {
    const json = await model.getExportableDashboardJson();

    return json;
  }, [isSharingExternally, exportMode]);

  const stringifiedDashboardJson = JSON.stringify(dashboardJson.value?.json, null, 2);
  const stringifiedDashboardYAML = yaml.dump(dashboardJson.value?.json, {
    skipInvalid: true,
  });
  const stringifiedDashboard = isViewingYAML ? stringifiedDashboardYAML : stringifiedDashboardJson;

  const onClickDownload = async () => {
    await model.onSaveAsFile();
    const message = t('export.json.download-successful_toast_message', 'Your JSON has been downloaded');
    dispatch(notifyApp(createSuccessNotification(message)));
  };

  const switchExportLabel = t('export.json.export-externally-label', 'Export the dashboard to use in another instance');

  return (
    <div data-testid={selector.container} className={styles.container}>
      <p>
        <Trans i18nKey="export.json.info-text">
          Copy or download a file containing the definition of your dashboard
        </Trans>
      </p>

      {config.featureToggles.kubernetesDashboards ? (
        <ResourceExport
          dashboardJson={dashboardJson}
          isSharingExternally={isSharingExternally ?? false}
          exportMode={exportMode ?? ExportMode.Classic}
          isViewingYAML={isViewingYAML ?? false}
          onExportModeChange={model.onExportModeChange}
          onShareExternallyChange={model.onShareExternallyChange}
          onViewYAML={model.onViewYAML}
        />
      ) : (
        <Stack gap={1} alignItems="start">
          <Switch
            label={switchExportLabel}
            data-testid={selector.exportExternallyToggle}
            id="export-externally-toggle"
            value={Boolean(isSharingExternally)}
            onChange={model.onShareExternallyChange}
          />
          <Label>{switchExportLabel}</Label>
        </Stack>
      )}

      <div className={styles.codeEditorBox}>
        <AutoSizer data-testid={selector.codeEditor}>
          {({ width, height }) => {
            if (stringifiedDashboard) {
              return (
                <CodeEditor
                  value={stringifiedDashboard}
                  language={isViewingYAML ? 'yaml' : 'json'}
                  showLineNumbers={true}
                  showMiniMap={false}
                  height={height}
                  width={width}
                  readOnly={true}
                />
              );
            }

            return dashboardJson.loading && <Spinner />;
          }}
        </AutoSizer>
      </div>
      <div className={styles.buttonsContainer}>
        <Stack gap={1} flex={1} direction={{ xs: 'column', sm: 'row' }}>
          <Button
            data-testid={selector.saveToFileButton}
            variant="primary"
            icon="download-alt"
            onClick={onClickDownload}
          >
            <Trans i18nKey="export.json.download-button">Download file</Trans>
          </Button>
          <ClipboardButton
            data-testid={selector.copyToClipboardButton}
            variant="secondary"
            icon="copy"
            disabled={dashboardJson.loading}
            getText={() => stringifiedDashboard ?? ''}
            onClipboardCopy={model.onClipboardCopy}
          >
            <Trans i18nKey="export.json.copy-button">Copy to clipboard</Trans>
          </ClipboardButton>
          <Button
            data-testid={selector.cancelButton}
            variant="secondary"
            onClick={model.useState().onDismiss}
            fill="outline"
          >
            <Trans i18nKey="export.json.cancel-button">Cancel</Trans>
          </Button>
        </Stack>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: '100%',
    }),
    codeEditorBox: css({
      margin: `${theme.spacing(2, 0)}`,
      height: '75%',
    }),
    buttonsContainer: css({
      paddingBottom: theme.spacing(2),
    }),
  };
}
