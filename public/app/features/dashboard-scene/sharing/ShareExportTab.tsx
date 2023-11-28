import saveAs from 'file-saver';
import React from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { config, getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef } from '@grafana/scenes';
import { Button, ClipboardButton, CodeEditor, Field, Modal, Switch, VerticalGroup } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { trackDashboardSharingActionPerType } from 'app/features/dashboard/components/ShareModal/analytics';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardModel } from 'app/features/dashboard/state';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { SceneShareTabState } from './types';

const exportExternallyTranslation = t('share-modal.export.share-externally-label', `Export for sharing externally`);
const exportDefaultTranslation = t('share-modal.export.share-default-label', `Export with default values removed`);

interface ShareExportTabState extends SceneShareTabState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  isSharingExternally?: boolean;
  shouldTrimDefaults?: boolean;
  isViewingJSON?: boolean;
}

export class ShareExportTab extends SceneObjectBase<ShareExportTabState> {
  static Component = ShareExportTabRenderer;

  private _exporter = new DashboardExporter();

  constructor(state: Omit<ShareExportTabState, 'panelRef'>) {
    super({
      isSharingExternally: false,
      shouldTrimDefaults: false,
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

  public onTrimDefaultsChange = () => {
    this.setState({
      shouldTrimDefaults: !this.state.shouldTrimDefaults,
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

  public async getExportableDashboardJson() {
    const { dashboardRef, isSharingExternally, shouldTrimDefaults } = this.state;
    const saveModel = transformSceneToSaveModel(dashboardRef.resolve());

    const exportable = isSharingExternally
      ? await this._exporter.makeExportable(new DashboardModel(saveModel))
      : saveModel;

    if (shouldTrimDefaults) {
      const trimmed = await getBackendSrv().post('/api/dashboards/trim', { dashboard: exportable });
      return trimmed.dashboard;
    } else {
      return exportable;
    }
  }

  public async onSaveAsFile() {
    const dashboardJson = await this.getExportableDashboardJson();
    const dashboardJsonPretty = JSON.stringify(dashboardJson, null, 2);

    const blob = new Blob([dashboardJsonPretty], {
      type: 'application/json;charset=utf-8',
    });

    const time = new Date().getTime();
    saveAs(blob, `${dashboardJson.title}-${time}.json`);
    trackDashboardSharingActionPerType('save_export', shareDashboardType.export);
  }
}

function ShareExportTabRenderer({ model }: SceneComponentProps<ShareExportTab>) {
  const { isSharingExternally, shouldTrimDefaults, isViewingJSON, modalRef } = model.useState();

  const dashboardJson = useAsync(async () => {
    if (isViewingJSON) {
      const json = await model.getExportableDashboardJson();
      return JSON.stringify(json, null, 2);
    }

    return '';
  }, [isViewingJSON]);

  return (
    <>
      {!isViewingJSON && (
        <>
          <p className="share-modal-info-text">
            <Trans i18nKey="share-modal.export.info-text">Export this dashboard.</Trans>
          </p>
          <VerticalGroup spacing="md">
            <Field label={exportExternallyTranslation}>
              <Switch
                id="share-externally-toggle"
                value={isSharingExternally}
                onChange={model.onShareExternallyChange}
              />
            </Field>

            {config.featureToggles.trimDefaults && (
              <Field label={exportDefaultTranslation}>
                <Switch id="trim-defaults-toggle" value={shouldTrimDefaults} onChange={model.onTrimDefaultsChange} />
              </Field>
            )}
          </VerticalGroup>

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
                return <div>Loading...</div>;
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
