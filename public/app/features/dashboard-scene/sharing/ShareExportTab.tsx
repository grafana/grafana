import saveAs from 'file-saver';
import yaml from 'js-yaml';
import { cloneDeep } from 'lodash';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { Button, ClipboardButton, CodeEditor, Field, Modal, Stack, Switch } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { ObjectMeta } from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { K8S_V2_DASHBOARD_API_CONFIG } from 'app/features/dashboard/api/v2';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { DashboardScene } from '../scene/DashboardScene';
import { makeExportableV1, makeExportableV2 } from '../scene/export/exporters';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { getVariablesCompatibility } from '../utils/getVariablesCompatibility';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { ExportMode, ResourceExport } from './ExportButton/ResourceExport';
import { SceneShareTabState, ShareView } from './types';

export interface ExportableResource {
  apiVersion: string;
  kind: 'Dashboard';
  metadata: DashboardWithAccessInfo<DashboardV2Spec>['metadata'] | Partial<ObjectMeta>;
  spec: Dashboard | DashboardModel | DashboardV2Spec | { error: unknown };
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

    if (isDashboardV2Spec(origDashboard) && 'elements' in exportable && initialSaveModelVersion === 'v2') {
      this.setState({
        exportMode: ExportMode.V2Resource,
      });

      return {
        json: {
          apiVersion: scene.serializer.apiVersion ?? '',
          kind: 'Dashboard',
          metadata,
          spec: exportable,
          status: {},
        },
        initialSaveModelVersion,
        hasLibraryPanels: Object.values(origDashboard.elements).some((element) => element.kind === 'LibraryPanel'),
      };
    }

    if (exportMode === ExportMode.V1Resource) {
      const spec = transformSceneToSaveModel(scene);

      return {
        json: {
          apiVersion: scene.serializer.apiVersion ?? '',
          kind: 'Dashboard',
          metadata,
          spec,
          status: {},
        },
        initialSaveModelVersion,
        hasLibraryPanels: undefined,
      };
    }

    if (exportMode === ExportMode.V2Resource) {
      const spec = transformSceneToSaveModelSchemaV2(scene);
      const specCopy = JSON.parse(JSON.stringify(spec));
      const statelessSpec = await makeExportableV2(specCopy);
      const exportableV2 = isSharingExternally ? statelessSpec : spec;

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
        hasLibraryPanels: undefined,
        initialSaveModelVersion,
      };
    }

    // legacy mode or classic mode when dashboardNewLayouts is disabled
    return {
      json: exportable,
      hasLibraryPanels: undefined,
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
