import { css } from '@emotion/css';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import {
  Alert,
  Button,
  ClipboardButton,
  CodeEditor,
  Label,
  Spinner,
  Stack,
  Switch,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { t, Trans } from 'app/core/internationalization';
import { dispatch } from 'app/store/store';

import { DashboardInteractions } from '../../utils/interactions';
import { ShareExportTab } from '../ShareExportTab';

const selector = e2eSelectors.pages.ExportDashboardDrawer.ExportAsJson;

export class ExportAsJson extends ShareExportTab {
  static Component = ExportAsJsonRenderer;

  public getTabLabel(): string {
    return t('export.json.title', 'Export dashboard JSON');
  }
}

function ExportAsJsonRenderer({ model }: SceneComponentProps<ExportAsJson>) {
  const styles = useStyles2(getStyles);
  const { isSharingExternally } = model.useState();

  const dashboardJson = useAsync(async () => {
    const json = await model.getExportableDashboardJson();
    return json;
  }, [isSharingExternally]);

  const stringifiedDashboardJson = JSON.stringify(dashboardJson.value?.json, null, 2);
  const hasLibraryPanels = dashboardJson.value?.hasLibraryPanels;
  const isV2Dashboard = dashboardJson.value?.json && 'elements' in dashboardJson.value.json;
  const showV2LibPanelAlert = isV2Dashboard && isSharingExternally && hasLibraryPanels;

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
          Copy or download a JSON file containing the JSON of your dashboard
        </Trans>
      </p>
      <Stack gap={2} direction="column">
        <Stack gap={1}>
          <Switch
            label={switchExportLabel}
            data-testid={selector.exportExternallyToggle}
            id="export-externally-toggle"
            value={isSharingExternally}
            onChange={model.onShareExternallyChange}
          />
          <Label>{switchExportLabel}</Label>
        </Stack>

        {showV2LibPanelAlert && (
          <Alert
            title={t(
              'dashboard-scene.save-dashboard-form.schema-v2-library-panels-export-title',
              'Dashboard Schema V2 does not support exporting library panels to be used in another instance yet'
            )}
            severity="warning"
          >
            <Trans i18nKey="dashboard-scene.save-dashboard-form.schema-v2-library-panels-export">
              The dynamic dashboard functionality is experimental, and has not full feature parity with current
              dashboards behaviour. It is based on a new schema format, that does not support library panels. This means
              that when exporting the dashboard to use it in another instance, we will not include library panels. We
              intend to support them as we progress in the feature{' '}
              <TextLink external href="https://grafana.com/docs/release-life-cycle/">
                life cycle
              </TextLink>
              .
            </Trans>
          </Alert>
        )}
      </Stack>
      <div className={styles.codeEditorBox}>
        <AutoSizer data-testid={selector.codeEditor}>
          {({ width, height }) => {
            if (stringifiedDashboardJson) {
              return (
                <CodeEditor
                  value={stringifiedDashboardJson}
                  language="json"
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
            getText={() => stringifiedDashboardJson ?? ''}
            onClipboardCopy={() => {
              DashboardInteractions.exportCopyJsonClicked();
            }}
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
