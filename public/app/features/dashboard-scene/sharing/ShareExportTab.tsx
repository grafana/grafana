import saveAs from 'file-saver';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Alert, Button, ClipboardButton, CodeEditor, Field, Modal, Stack, Switch, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { SceneShareTabState, ShareView } from './types';

export interface ShareExportTabState extends SceneShareTabState {
  isSharingExternally?: boolean;
  isViewingJSON?: boolean;
}

export class ShareExportTab extends SceneObjectBase<ShareExportTabState> implements ShareView {
  public tabId = shareDashboardType.export;
  static Component = ShareExportTabRenderer;

  constructor(state: Omit<ShareExportTabState, 'panelRef'>) {
    super({
      isSharingExternally: false,
      isViewingJSON: false,
      ...state,
    });
  }

  public getTabLabel() {
    return t('share-modal.tab-title.export', 'Export');
  }

  public onShareExternallyChange = () => {
    this.setState({
      isSharingExternally: !this.state.isSharingExternally,
    });
  };

  public onViewJSON = () => {
    this.setState({
      isViewingJSON: !this.state.isViewingJSON,
    });
  };

  public getClipboardText() {
    return;
  }

  public getExportableDashboardJson = async (): Promise<{
    json: Dashboard | DashboardJson | DashboardV2Spec | { error: unknown };
    hasLibraryPanels?: boolean;
  }> => {
    const { isSharingExternally } = this.state;

    const scene = getDashboardSceneFor(this);
    const exportableDashboard = await scene.serializer.makeExportableExternally(scene);
    const origDashboard = scene.serializer.getSaveModel(scene);
    const exportable = isSharingExternally ? exportableDashboard : origDashboard;

    if (isDashboardV2Spec(origDashboard)) {
      return {
        json: exportable,
        hasLibraryPanels: Object.values(origDashboard.elements).some((element) => element.kind === 'LibraryPanel'),
      };
    }

    return {
      json: exportable,
      hasLibraryPanels: undefined,
    };
  };

  public onSaveAsFile = async () => {
    const dashboard = await this.getExportableDashboardJson();
    const dashboardJsonPretty = JSON.stringify(dashboard.json, null, 2);
    const { isSharingExternally } = this.state;

    const blob = new Blob([dashboardJsonPretty], {
      type: 'application/json;charset=utf-8',
    });

    const time = new Date().getTime();
    let title = 'dashboard';
    if ('title' in dashboard.json && dashboard.json.title) {
      title = dashboard.json.title;
    }
    saveAs(blob, `${title}-${time}.json`);
    DashboardInteractions.exportDownloadJsonClicked({
      externally: isSharingExternally,
    });
  };
}

function ShareExportTabRenderer({ model }: SceneComponentProps<ShareExportTab>) {
  const { isSharingExternally, isViewingJSON, modalRef } = model.useState();

  const dashboardJson = useAsync(async () => {
    const json = await model.getExportableDashboardJson();
    return json;
  }, [isViewingJSON, isSharingExternally]);

  const stringifiedDashboardJson = JSON.stringify(dashboardJson.value?.json, null, 2);
  const hasLibraryPanels = dashboardJson.value?.hasLibraryPanels;

  const isV2Dashboard = dashboardJson.value?.json && 'elements' in dashboardJson.value.json;
  const showV2LibPanelAlert = isV2Dashboard && isSharingExternally && hasLibraryPanels;

  const exportExternallyTranslation = t('share-modal.export.share-externally-label', `Export for sharing externally`);

  return (
    <>
      {!isViewingJSON && (
        <>
          <p>
            <Trans i18nKey="share-modal.export.info-text">Export this dashboard.</Trans>
          </p>
          <Stack gap={2} direction="column">
            <Field label={exportExternallyTranslation}>
              <Switch
                id="share-externally-toggle"
                value={isSharingExternally}
                onChange={model.onShareExternallyChange}
              />
            </Field>
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
                  dashboards behaviour. It is based on a new schema format, that does not support library panels. This
                  means that when exporting the dashboard to use it in another instance, we will not include library
                  panels. We intend to support them as we progress in the feature{' '}
                  <TextLink external href="https://grafana.com/docs/release-life-cycle/">
                    life cycle
                  </TextLink>
                  .
                </Trans>
              </Alert>
            )}
          </Stack>

          <Modal.ButtonRow>
            <Button
              variant="secondary"
              onClick={() => {
                modalRef?.resolve().onDismiss();
              }}
              fill="outline"
            >
              <Trans i18nKey="share-modal.export.cancel-button">Cancel</Trans>
            </Button>
            <Button variant="secondary" icon="brackets-curly" onClick={model.onViewJSON}>
              <Trans i18nKey="share-modal.export.view-button">View JSON</Trans>
            </Button>
            <Button variant="primary" icon="save" onClick={() => model.onSaveAsFile()}>
              <Trans i18nKey="share-modal.export.save-button">Save to file</Trans>
            </Button>
          </Modal.ButtonRow>
        </>
      )}
      {isViewingJSON && (
        <>
          <AutoSizer disableHeight>
            {({ width }) => {
              if (dashboardJson.value) {
                return (
                  <CodeEditor
                    value={stringifiedDashboardJson}
                    showLineNumbers={true}
                    language="json"
                    showMiniMap={false}
                    height="500px"
                    width={width}
                  />
                );
              }

              if (dashboardJson.loading) {
                return (
                  <div>
                    {' '}
                    <Trans i18nKey="share-modal.export.loading">Loading...</Trans>
                  </div>
                );
              }

              return null;
            }}
          </AutoSizer>

          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={model.onViewJSON} icon="arrow-left">
              <Trans i18nKey="share-modal.export.back-button">Back to export config</Trans>
            </Button>
            <ClipboardButton
              variant="secondary"
              icon="copy"
              disabled={dashboardJson.loading}
              getText={() => stringifiedDashboardJson ?? ''}
            >
              <Trans i18nKey="share-modal.view-json.copy-button">Copy to Clipboard</Trans>
            </ClipboardButton>
            <Button variant="primary" icon="save" disabled={dashboardJson.loading} onClick={() => model.onSaveAsFile()}>
              <Trans i18nKey="share-modal.export.save-button">Save to file</Trans>
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </>
  );
}
