import saveAs from 'file-saver';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Button, ClipboardButton, CodeEditor, Field, Modal, Stack, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { getVariablesCompatibility } from '../utils/getVariablesCompatibility';
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

  private _exporter = new DashboardExporter();

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

  public getExportableDashboardJson = async () => {
    const { isSharingExternally } = this.state;
    const saveModel = transformSceneToSaveModel(getDashboardSceneFor(this));

    const exportable = isSharingExternally
      ? await this._exporter.makeExportable(
          new DashboardModel(saveModel, undefined, {
            getVariablesFromState: () => {
              return getVariablesCompatibility(window.__grafanaSceneContext);
            },
          })
        )
      : saveModel;

    return exportable;
  };

  public onSaveAsFile = async () => {
    const dashboardJson = await this.getExportableDashboardJson();
    const dashboardJsonPretty = JSON.stringify(dashboardJson, null, 2);
    const { isSharingExternally } = this.state;

    const blob = new Blob([dashboardJsonPretty], {
      type: 'application/json;charset=utf-8',
    });

    const time = new Date().getTime();
    let title = 'dashboard';
    if ('title' in dashboardJson && dashboardJson.title) {
      title = dashboardJson.title;
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
    if (isViewingJSON) {
      const json = await model.getExportableDashboardJson();
      return JSON.stringify(json, null, 2);
    }

    return '';
  }, [isViewingJSON]);

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
                    value={dashboardJson.value ?? ''}
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
              getText={() => dashboardJson.value ?? ''}
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
