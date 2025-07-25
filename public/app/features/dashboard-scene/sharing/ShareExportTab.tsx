import saveAs from 'file-saver';
import yaml from 'js-yaml';
import { cloneDeep } from 'lodash';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Button, ClipboardButton, CodeEditor, Field, Modal, Stack, Switch } from '@grafana/ui';
import { ObjectMeta } from 'app/features/apiserver/types';
import { transformDashboardV2SpecToV1 } from 'app/features/dashboard/api/ResponseTransformers';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardV2Spec, isV1ClassicDashboard } from 'app/features/dashboard/api/utils';
import { K8S_V1_DASHBOARD_API_CONFIG } from 'app/features/dashboard/api/v1';
import { K8S_V2_DASHBOARD_API_CONFIG } from 'app/features/dashboard/api/v2';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardJson } from 'app/features/manage-dashboards/types';
import { DashboardDataDTO } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';
import { makeExportableV1, makeExportableV2 } from '../scene/export/exporters';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { getVariablesCompatibility } from '../utils/getVariablesCompatibility';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor, hasLibraryPanelsInV1Dashboard } from '../utils/utils';

import { ExportMode, ResourceExport } from './ExportButton/ResourceExport';
import { SceneShareTabState, ShareView } from './types';

export interface ExportableResource {
  apiVersion: string;
  kind: 'Dashboard';
  metadata: DashboardWithAccessInfo<DashboardV2Spec>['metadata'] | Partial<ObjectMeta>;
  spec: Dashboard | DashboardModel | DashboardV2Spec | DashboardJson | DashboardDataDTO | { error: unknown };
  // A placeholder for now because as code tooling expects it
  status: {};
}

export interface ShareExportTabState extends SceneShareTabState {
  isSharingExternally?: boolean;
  isViewingJSON?: boolean;
  isViewingYAML?: boolean;
  exportMode?: ExportMode;
}

export class ShareExportTab extends SceneObjectBase<ShareExportTabState> implements ShareView {
  public tabId = shareDashboardType.export;
  static Component = ShareExportTabRenderer;

  constructor(state: Omit<ShareExportTabState, 'panelRef'>) {
    super({
      ...state,
      isSharingExternally: false,
      isViewingJSON: false,
      exportMode: config.featureToggles.kubernetesDashboards ? ExportMode.Classic : undefined,
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

  public onExportModeChange = (exportMode: ExportMode) => {
    this.setState({
      exportMode,
    });

    if (exportMode === ExportMode.Classic) {
      this.setState({
        isViewingYAML: false,
      });
    }
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
    const { isSharingExternally, exportMode } = this.state;

    const scene = getDashboardSceneFor(this);
    const exportableDashboard = await scene.serializer.makeExportableExternally(scene);
    const initialSaveModel = scene.getInitialSaveModel();
    const initialSaveModelVersion = initialSaveModel && isDashboardV2Spec(initialSaveModel) ? 'v2' : 'v1';
    const origDashboard = scene.serializer.getSaveModel(scene);
    const exportable = isSharingExternally ? exportableDashboard : origDashboard;
    const metadata = getMetadata(scene, Boolean(isSharingExternally));

    if (
      isDashboardV2Spec(origDashboard) &&
      'elements' in exportable &&
      initialSaveModelVersion === 'v2' &&
      exportMode !== ExportMode.V1Resource
    ) {
      this.setState({
        exportMode: ExportMode.V2Resource,
      });

      // For automatic V2 path, also process library panels when sharing externally
      let finalSpec = exportable;
      if (isSharingExternally && isDashboardV2Spec(exportable)) {
        const specCopy = JSON.parse(JSON.stringify(exportable));
        const result = await makeExportableV2(specCopy, isSharingExternally);
        if ('error' in result) {
          return {
            json: { error: result.error },
            initialSaveModelVersion,
            hasLibraryPanels: Object.values(origDashboard.elements).some((element) => element.kind === 'LibraryPanel'),
          };
        }
        finalSpec = result;
      }

      return {
        json: {
          apiVersion: scene.serializer.apiVersion ?? '',
          kind: 'Dashboard',
          metadata,
          spec: finalSpec,
          status: {},
        },
        initialSaveModelVersion,
        hasLibraryPanels: Object.values(origDashboard.elements).some((element) => element.kind === 'LibraryPanel'),
      };
    }

    if (exportMode === ExportMode.V1Resource) {
      // Check if source is V2 and auto-transform to V1
      if (isDashboardV2Spec(origDashboard) && initialSaveModelVersion === 'v2') {
        try {
          const spec = transformSceneToSaveModelSchemaV2(scene);
          const metadata = getMetadata(scene, Boolean(isSharingExternally));
          const spec1 = transformDashboardV2SpecToV1(spec, {
            name: metadata.name ?? '',
            generation: metadata.generation ?? 0,
            resourceVersion: metadata.resourceVersion ?? '0',
            creationTimestamp: metadata.creationTimestamp ?? '',
          });

          let exportableV1: Dashboard | DashboardDataDTO | DashboardJson | { error: unknown };
          if (isSharingExternally) {
            const oldModel = new DashboardModel(spec1, undefined, {
              getVariablesFromState: () => {
                return getVariablesCompatibility(window.__grafanaSceneContext);
              },
            });
            exportableV1 = await makeExportableV1(oldModel);
          } else {
            exportableV1 = spec1;
          }
          return {
            json: {
              // Forcing V1 version here to match export mode selection
              apiVersion: `${K8S_V1_DASHBOARD_API_CONFIG.group}/${K8S_V1_DASHBOARD_API_CONFIG.version}`,
              kind: 'Dashboard',
              metadata,
              spec: exportableV1,
              status: {},
            },
            initialSaveModelVersion,
            hasLibraryPanels: hasLibraryPanelsInV1Dashboard(spec1),
          };
        } catch (err) {
          return {
            json: {
              error: `Failed to convert dashboard to v1. ${err}`,
            },
            initialSaveModelVersion,
            hasLibraryPanels: undefined,
          };
        }
      } else {
        // Source is already V1, export as-is
        const spec = transformSceneToSaveModel(scene);
        return {
          json: {
            // Forcing V1 version here to match export mode selection
            apiVersion: `${K8S_V1_DASHBOARD_API_CONFIG.group}/${K8S_V1_DASHBOARD_API_CONFIG.version}`,
            kind: 'Dashboard',
            metadata,
            spec,
            status: {},
          },
          initialSaveModelVersion,
          hasLibraryPanels: hasLibraryPanelsInV1Dashboard(spec),
        };
      }
    }

    if (exportMode === ExportMode.V2Resource) {
      const spec = transformSceneToSaveModelSchemaV2(scene);
      const specCopy = JSON.parse(JSON.stringify(spec));
      const statelessSpec = await makeExportableV2(specCopy, isSharingExternally);
      const exportableV2 = isSharingExternally ? statelessSpec : spec;
      // Check if dashboard contains library panels based on dashboard version
      let hasLibraryPanels = false;
      // Case: V1 dashboard loaded (with kubernetesDashboards enabled and dashboardNewLayouts disabled), and user explicitly selected V2Resource export mode
      if (initialSaveModelVersion === 'v1' && !isDashboardV2Spec(origDashboard)) {
        hasLibraryPanels = hasLibraryPanelsInV1Dashboard(origDashboard);
      } else if (isDashboardV2Spec(origDashboard)) {
        // Case: V2 dashboard (either originally V2 or transformed from V1) being exported as V2Resource
        hasLibraryPanels = Object.values(origDashboard.elements).some((element) => element.kind === 'LibraryPanel');
      }

      return {
        json: {
          // Forcing V2 version here because in this case we have v1 serializer
          apiVersion: `${K8S_V2_DASHBOARD_API_CONFIG.group}/${K8S_V2_DASHBOARD_API_CONFIG.version}`,
          kind: 'Dashboard',
          metadata,
          spec: exportableV2,
          status: {},
        },
        initialSaveModelVersion,
        hasLibraryPanels,
      };
    }

    // Classic mode
    // This handles a case when:
    // 1. dashboardNewLayouts feature toggle is enabled
    // 2. v1 dashboard is loaded
    // 3. dashboard hasn't been edited yet - if it was edited, user would be forced to save it in v2 version
    if (
      initialSaveModelVersion === 'v1' &&
      isDashboardV2Spec(origDashboard) &&
      initialSaveModel &&
      'panels' in initialSaveModel
    ) {
      const oldModel = new DashboardModel(initialSaveModel, undefined, {
        getVariablesFromState: () => {
          return getVariablesCompatibility(window.__grafanaSceneContext);
        },
      });
      const exportableV1 = isSharingExternally ? await makeExportableV1(oldModel) : initialSaveModel;
      return {
        json: exportableV1,
        hasLibraryPanels: hasLibraryPanelsInV1Dashboard(initialSaveModel),
        initialSaveModelVersion,
      };
    }

    // legacy mode or classic mode when dashboardNewLayouts is disabled
    // At this point we know that dashboard should be V1 or could have produced an error
    return {
      json: exportable,
      hasLibraryPanels:
        'error' in exportable || !isV1ClassicDashboard(origDashboard)
          ? false
          : hasLibraryPanelsInV1Dashboard(origDashboard),
      initialSaveModelVersion,
    };
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
    const { isSharingExternally, isViewingYAML, exportMode } = this.state;

    DashboardInteractions.exportCopyJsonClicked({
      externally: isSharingExternally,
      dashboard_schema_version: dashboard.initialSaveModelVersion,
      has_library_panels: Boolean(dashboard.hasLibraryPanels),
      export_mode: exportMode || 'classic',
      format: isViewingYAML ? 'yaml' : 'json',
      action: 'copy',
    });
  };
}

function getMetadata(
  scene: DashboardScene,
  isSharingExternally: boolean
): DashboardWithAccessInfo<DashboardV2Spec>['metadata'] | Partial<ObjectMeta> {
  let result: Partial<ObjectMeta> = {};

  if (scene.serializer.metadata) {
    if ('k8s' in scene.serializer.metadata) {
      result = scene.serializer.metadata.k8s ? cloneDeep(scene.serializer.metadata.k8s) : {};
    } else if ('annotations' in scene.serializer.metadata) {
      result = cloneDeep(scene.serializer.metadata);
    }
  }

  if ('managedFields' in result) {
    delete result['managedFields'];
  }

  if (isSharingExternally) {
    // Remove fields that are not needed for sharing externally
    if ('uid' in result) {
      delete result['uid'];
    }
    delete result['resourceVersion'];
    delete result['namespace'];

    // iterate over labels and delete all keys that start with grafana.app/
    for (const key in result['labels']) {
      if (key.startsWith('grafana.app/')) {
        // @ts-expect-error
        delete result['labels'][key];
      }
    }

    // iterate over annotations and delete all keys that start with grafana.app/
    for (const key in result['annotations']) {
      if (key.startsWith('grafana.app/')) {
        // @ts-expect-error
        delete result['annotations'][key];
      }
    }
  }

  return result;
}

function ShareExportTabRenderer({ model }: SceneComponentProps<ShareExportTab>) {
  const { isSharingExternally, isViewingJSON, modalRef, exportMode, isViewingYAML } = model.useState();

  const dashboardJson = useAsync(async () => {
    const json = await model.getExportableDashboardJson();
    return json;
  }, [isViewingJSON, isSharingExternally, exportMode]);

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
              exportMode={exportMode ?? ExportMode.Classic}
              isViewingYAML={isViewingYAML ?? false}
              onExportModeChange={model.onExportModeChange}
              onShareExternallyChange={model.onShareExternallyChange}
              onViewYAML={model.onViewYAML}
            />
          ) : (
            <Stack gap={2} direction="column">
              <Field label={exportExternallyTranslation}>
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
