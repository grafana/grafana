import saveAs from 'file-saver';
import yaml from 'js-yaml';
import { cloneDeep } from 'lodash';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Button, ClipboardButton, CodeEditor, Field, Modal, Stack, Switch } from '@grafana/ui';
import { ObjectMeta } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { ExportFormat } from 'app/features/dashboard/api/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { makeExportableV1, makeExportableV2 } from '../scene/export/exporters';
import { getVariablesCompatibility } from '../utils/getVariablesCompatibility';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor, hasLibraryPanelsInV1Dashboard } from '../utils/utils';

import { ResourceExport } from './ExportButton/ResourceExport';
import { SceneShareTabState, ShareView } from './types';

export interface ExportableResource {
  apiVersion: string;
  kind: 'Dashboard';
  metadata: Partial<ObjectMeta>;
  spec: Dashboard | DashboardV2Spec | DashboardJson | { error: unknown };
}

export interface ShareExportTabState extends SceneShareTabState {
  isSharingExternally?: boolean;
  isViewingJSON?: boolean;
  isViewingYAML?: boolean;
  exportFormat?: ExportFormat;
}

export class ShareExportTab extends SceneObjectBase<ShareExportTabState> implements ShareView {
  public tabId = shareDashboardType.export;
  static Component = ShareExportTabRenderer;

  constructor(state: Omit<ShareExportTabState, 'panelRef'>) {
    super({
      ...state,
      isSharingExternally: false,
      isViewingJSON: false,
      exportFormat: config.featureToggles.dashboardNewLayouts ? ExportFormat.V2Resource : ExportFormat.Classic,
    });
  }

  public getTabLabel() {
    return t('share-modal.tab-title.export', 'Export');
  }

  public getSubtitle(): string | undefined {
    return undefined;
  }

  public onShareExternallyChange = () => {
    this.setState({
      isSharingExternally: !this.state.isSharingExternally,
    });
  };

  public onExportFormatChange = (exportFormat: ExportFormat) => {
    this.setState({
      exportFormat,
      ...(exportFormat === ExportFormat.Classic && { isViewingYAML: false }),
    });
  };

  public onViewJSON = () => {
    this.setState({
      isViewingJSON: !this.state.isViewingJSON,
    });
  };

  public onViewYAML = () => {
    this.setState({
      isViewingYAML: !this.state.isViewingYAML,
    });
  };

  public getClipboardText() {
    return;
  }

  public getExportableDashboardJson = async (): Promise<{
    json: Dashboard | DashboardJson | DashboardV2Spec | ExportableResource | { error: unknown };
    hasLibraryPanels?: boolean;
    initialSaveModelVersion: 'v1' | 'v2';
  }> => {
    const { isSharingExternally, exportFormat } = this.state;
    const scene = getDashboardSceneFor(this);
    const uid = scene.state.uid;

    if (!uid) {
      return {
        json: { error: 'Dashboard has no UID. Save the dashboard first.' },
        initialSaveModelVersion: 'v1',
        hasLibraryPanels: undefined,
      };
    }

    const initialSaveModel = scene.getInitialSaveModel();
    const initialSaveModelVersion = initialSaveModel && isDashboardV2Spec(initialSaveModel) ? 'v2' : 'v1';

    // When kubernetesDashboards is off, use the legacy scene-based export
    if (!config.featureToggles.kubernetesDashboards) {
      const origDashboard = scene.serializer.getSaveModel(scene);
      const exportable = isSharingExternally ? await scene.serializer.makeExportableExternally(scene) : origDashboard;
      return {
        json: exportable,
        hasLibraryPanels:
          'error' in exportable || !('panels' in origDashboard) ? false : hasLibraryPanelsInV1Dashboard(origDashboard),
        initialSaveModelVersion,
      };
    }

    if (exportFormat === ExportFormat.V2Resource) {
      return this.fetchV2Resource(uid, isSharingExternally, initialSaveModelVersion);
    }

    return this.fetchClassic(uid, isSharingExternally, initialSaveModelVersion);
  };

  private fetchClassic = async (
    uid: string,
    isSharingExternally: boolean | undefined,
    initialSaveModelVersion: 'v1' | 'v2'
  ): Promise<{
    json: Dashboard | DashboardJson | { error: unknown };
    hasLibraryPanels?: boolean;
    initialSaveModelVersion: 'v1' | 'v2';
  }> => {
    try {
      const dto = await getDashboardAPI('v1').getDashboardDTO(uid);
      const spec = dto.dashboard;

      if (isSharingExternally) {
        const model = new DashboardModel(spec, undefined, {
          getVariablesFromState: () => getVariablesCompatibility(window.__grafanaSceneContext),
        });
        return {
          json: await makeExportableV1(model),
          hasLibraryPanels: hasLibraryPanelsInV1Dashboard(spec),
          initialSaveModelVersion,
        };
      }

      return {
        json: spec,
        hasLibraryPanels: hasLibraryPanelsInV1Dashboard(spec),
        initialSaveModelVersion,
      };
    } catch (err) {
      return {
        json: {
          error: `Failed to fetch dashboard in classic format. ${err instanceof Error ? err.message : String(err)}`,
        },
        initialSaveModelVersion,
        hasLibraryPanels: undefined,
      };
    }
  };

  private fetchV2Resource = async (
    uid: string,
    isSharingExternally: boolean | undefined,
    initialSaveModelVersion: 'v1' | 'v2'
  ): Promise<{
    json: ExportableResource | { error: unknown };
    hasLibraryPanels?: boolean;
    initialSaveModelVersion: 'v1' | 'v2';
  }> => {
    try {
      const resource = await getDashboardAPI('v2').getDashboardDTO(uid);
      const spec = resource.spec;
      const hasLibraryPanels =
        'elements' in spec
          ? Object.values(spec.elements).some((el: { kind: string }) => el.kind === 'LibraryPanel')
          : false;

      if (isSharingExternally) {
        const specCopy = JSON.parse(JSON.stringify(resource.spec));
        const exportedSpec = await makeExportableV2(specCopy, true);
        if ('error' in exportedSpec) {
          return {
            json: { error: exportedSpec.error },
            initialSaveModelVersion,
            hasLibraryPanels,
          };
        }
        return {
          json: {
            apiVersion: resource.apiVersion,
            kind: 'Dashboard',
            metadata: stripMetadataForExport(resource.metadata, true),
            spec: exportedSpec,
          },
          initialSaveModelVersion,
          hasLibraryPanels,
        };
      }

      return {
        json: {
          apiVersion: resource.apiVersion,
          kind: 'Dashboard',
          metadata: stripMetadataForExport(resource.metadata, false),
          spec: resource.spec,
        },
        initialSaveModelVersion,
        hasLibraryPanels,
      };
    } catch (err) {
      return {
        json: {
          error: `Failed to fetch dashboard as V2 resource. ${err instanceof Error ? err.message : String(err)}`,
        },
        initialSaveModelVersion,
        hasLibraryPanels: undefined,
      };
    }
  };

  public onSaveAsFile = async () => {
    const dashboard = await this.getExportableDashboardJson();
    const dashboardJsonPretty = JSON.stringify(dashboard.json, null, 2);
    const { isSharingExternally, isViewingYAML } = this.state;

    const blob = new Blob([isViewingYAML ? yaml.dump(dashboard.json) : dashboardJsonPretty], {
      type: 'application/json;charset=utf-8',
    });

    const time = new Date().getTime();
    let title = 'dashboard';
    if ('title' in dashboard.json && dashboard.json.title) {
      title = dashboard.json.title;
    }
    const extension = isViewingYAML ? 'yaml' : 'json';
    saveAs(blob, `${title}-${time}.${extension}`);

    DashboardInteractions.exportDownloadJsonClicked({
      externally: isSharingExternally,
      dashboard_schema_version: dashboard.initialSaveModelVersion,
      has_library_panels: Boolean(dashboard.hasLibraryPanels),
      format: isViewingYAML ? 'yaml' : 'json',
      action: 'download',
    });
  };

  public onClipboardCopy = async () => {
    const dashboard = await this.getExportableDashboardJson();
    const { isSharingExternally, isViewingYAML, exportFormat } = this.state;

    DashboardInteractions.exportCopyJsonClicked({
      externally: isSharingExternally,
      dashboard_schema_version: dashboard.initialSaveModelVersion,
      has_library_panels: Boolean(dashboard.hasLibraryPanels),
      export_mode: exportFormat || ExportFormat.Classic,
      format: isViewingYAML ? 'yaml' : 'json',
      action: 'copy',
    });
  };
}

function stripMetadataForExport(metadata: ObjectMeta, isSharingExternally: boolean): Partial<ObjectMeta> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = cloneDeep(metadata);

  delete result['managedFields'];

  if (isSharingExternally) {
    delete result['uid'];
    delete result['resourceVersion'];
    delete result['namespace'];

    for (const key in result['labels']) {
      if (key.startsWith('grafana.app/')) {
        delete result['labels'][key];
      }
    }

    for (const key in result['annotations']) {
      if (key.startsWith('grafana.app/')) {
        delete result['annotations'][key];
      }
    }
  }

  return result;
}

function ShareExportTabRenderer({ model }: SceneComponentProps<ShareExportTab>) {
  const { isSharingExternally, isViewingJSON, modalRef, exportFormat, isViewingYAML } = model.useState();

  const dashboardJson = useAsync(async () => {
    return model.getExportableDashboardJson();
  }, [isViewingJSON, isSharingExternally, exportFormat]);

  const stringifiedDashboardJson = JSON.stringify(dashboardJson.value?.json, null, 2);
  const stringifiedDashboardYAML = yaml.dump(dashboardJson.value?.json, {
    skipInvalid: true,
  });
  const stringifiedDashboard = isViewingYAML ? stringifiedDashboardYAML : stringifiedDashboardJson;

  const exportExternallyTranslation = t('share-modal.export.share-externally-label', `Export for sharing externally`);

  return (
    <>
      {!isViewingJSON && (
        <>
          <p>
            <Trans i18nKey="share-modal.export.info-text">Export this dashboard.</Trans>
          </p>
          {config.featureToggles.kubernetesDashboards ? (
            <ResourceExport
              dashboardJson={dashboardJson}
              isSharingExternally={isSharingExternally ?? false}
              exportFormat={
                exportFormat ??
                (config.featureToggles.dashboardNewLayouts ? ExportFormat.V2Resource : ExportFormat.Classic)
              }
              isViewingYAML={isViewingYAML ?? false}
              onExportFormatChange={model.onExportFormatChange}
              onShareExternallyChange={model.onShareExternallyChange}
              onViewYAML={model.onViewYAML}
            />
          ) : (
            <Stack gap={2} direction="column">
              <Field label={exportExternallyTranslation} noMargin>
                <Switch
                  id="share-externally-toggle"
                  value={isSharingExternally}
                  onChange={model.onShareExternallyChange}
                />
              </Field>
            </Stack>
          )}

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
            {isViewingYAML ? (
              <Button variant="secondary" icon="brackets-curly" onClick={model.onViewJSON}>
                <Trans i18nKey="share-modal.export.view-button-yaml">View YAML</Trans>
              </Button>
            ) : (
              <Button variant="secondary" icon="brackets-curly" onClick={model.onViewJSON}>
                <Trans i18nKey="share-modal.export.view-button">View JSON</Trans>
              </Button>
            )}
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
                    value={stringifiedDashboard}
                    showLineNumbers={true}
                    language={isViewingYAML ? 'yaml' : 'json'}
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
              getText={() => stringifiedDashboard ?? ''}
              onClipboardCopy={model.onClipboardCopy}
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
