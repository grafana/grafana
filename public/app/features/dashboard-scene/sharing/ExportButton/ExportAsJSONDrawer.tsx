import saveAs from 'file-saver';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Button, ClipboardButton, CodeEditor, Field, Modal, Stack, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardExporter } from 'app/features/dashboard/components/DashExportModal';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardModel } from 'app/features/dashboard/state';

import { DashboardScene } from '../../scene/DashboardScene';
import { transformSceneToSaveModel } from '../../serialization/transformSceneToSaveModel';
import { getVariablesCompatibility } from '../../utils/getVariablesCompatibility';
import { DashboardInteractions } from '../../utils/interactions';

export interface ExportAsJSONDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  isSharingExternally?: boolean;
}

export class ExportAsJSONDrawer extends SceneObjectBase<ExportAsJSONDrawerState> {
  public tabId = shareDashboardType.export;
  static Component = ExportAsJSONDrawerRenderer;

  private _exporter = new DashboardExporter();

  constructor(state: ExportAsJSONDrawerState) {
    super({
      isSharingExternally: true,
      ...state,
    });
  }

  public onShareExternallyChange = () => {
    this.setState({
      isSharingExternally: !this.state.isSharingExternally,
    });
  };

  public getClipboardText() {
    return;
  }

  public async getExportableDashboardJson() {
    const { dashboardRef, isSharingExternally } = this.state;
    const saveModel = transformSceneToSaveModel(dashboardRef.resolve());

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
  }

  public async onSaveAsFile() {
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
  }
}

function ExportAsJSONDrawerRenderer({ model }: SceneComponentProps<ExportAsJSONDrawer>) {
  const { isSharingExternally } = model.useState();

  const dashboardJson = useAsync(async () => {
    const json = await model.getExportableDashboardJson();
    return JSON.stringify(json, null, 2);
  });

  const exportExternallyTranslation = t(
    'share-modal.export.share-externally-label',
    `Export the dashboard to use in another instance`
  );

  return (
    <>
      <p className="share-modal-info-text">
        <Trans i18nKey="share-modal.export.info-text">
          Copy or download a JSON file containing the JSON of your dashboard.
        </Trans>
      </p>
      <Stack gap={2} direction="column">
        <Field label={exportExternallyTranslation}>
          <Switch id="share-externally-toggle" value={isSharingExternally} onChange={model.onShareExternallyChange} />
        </Field>
      </Stack>

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
                readOnly={true}
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
        <Button variant="primary" icon="download-alt" onClick={() => model.onSaveAsFile()}>
          <Trans i18nKey="share-modal.export.save-button">Save to file</Trans>
        </Button>
        <ClipboardButton
          variant="secondary"
          icon="copy"
          disabled={dashboardJson.loading}
          getText={() => dashboardJson.value ?? ''}
        >
          <Trans i18nKey="share-modal.view-json.copy-button">Copy to Clipboard</Trans>
        </ClipboardButton>
        <Button
          variant="secondary"
          onClick={() => {
            // modalRef?.resolve().onDismiss();
          }}
          fill="outline"
        >
          <Trans i18nKey="share-modal.export.cancel-button">Cancel</Trans>
        </Button>
      </Modal.ButtonRow>
    </>
  );
}
