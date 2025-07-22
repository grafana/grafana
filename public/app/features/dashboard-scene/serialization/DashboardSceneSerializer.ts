import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { AnnoKeyDashboardSnapshotOriginalUrl, ObjectMeta } from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { SaveDashboardAsOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { DASHBOARD_SCHEMA_VERSION } from 'app/features/dashboard/state/DashboardMigrator';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import {
  getPanelPluginCounts,
  getV1SchemaVariables,
  getV2SchemaVariables,
} from 'app/features/dashboard/utils/tracking';
import { DashboardJson } from 'app/features/manage-dashboards/types';
import { DashboardMeta, SaveDashboardResponseDTO } from 'app/types/dashboard';

import { getRawDashboardChanges, getRawDashboardV2Changes } from '../saving/getDashboardChanges';
import { DashboardChangeInfo } from '../saving/shared';
import { DashboardScene } from '../scene/DashboardScene';
import { makeExportableV1, makeExportableV2 } from '../scene/export/exporters';
import { getVariablesCompatibility } from '../utils/getVariablesCompatibility';
import { getVizPanelKeyForPanelId } from '../utils/utils';

import { transformSceneToSaveModel } from './transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

/**
 * T is the type of the save model
 * M is the type of the metadata
 * I is the type of the initial save model. By default it's the same as T.
 */
export interface DashboardSceneSerializerLike<T, M, I = T, E = T | { error: unknown }> {
  /**
   * The save model which the dashboard scene was originally created from
   */
  initialSaveModel?: I;
  metadata?: M;
  apiVersion?: string;
  initializeElementMapping(saveModel: T | undefined): void;
  initializeDSReferencesMapping(saveModel: T | undefined): void;
  getSaveModel: (s: DashboardScene) => T;
  getSaveAsModel: (s: DashboardScene, options: SaveDashboardAsOptions) => T;
  getDashboardChangesFromScene: (
    scene: DashboardScene,
    options: {
      saveTimeRange?: boolean;
      saveVariables?: boolean;
      saveRefresh?: boolean;
    }
  ) => DashboardChangeInfo;
  onSaveComplete(saveModel: T, result: SaveDashboardResponseDTO): void;
  getTrackingInformation: (s: DashboardScene) => DashboardTrackingInfo | undefined;
  getSnapshotUrl: () => string | undefined;
  getPanelIdForElement: (elementId: string) => number | undefined;
  getElementIdForPanel: (panelId: number) => string | undefined;
  getElementPanelMapping: () => Map<string, number>;
  getDSReferencesMapping: () => DSReferencesMapping;
  makeExportableExternally: (s: DashboardScene) => Promise<E | { error: unknown }>;
  getK8SMetadata: () => Partial<ObjectMeta> | undefined;
}

interface DashboardTrackingInfo {
  uid?: string;
  title?: string;
  schemaVersion: number;
  panels_count: number;
  settings_nowdelay?: number;
  settings_livenow?: boolean;
}

export interface DSReferencesMapping {
  panels: Map<string, Set<string>>;
  variables: Set<string>;
  annotations: Set<string>;
}

export class V1DashboardSerializer
  implements DashboardSceneSerializerLike<Dashboard, DashboardMeta, Dashboard, DashboardJson>
{
  initialSaveModel?: Dashboard;
  metadata?: DashboardMeta;
  protected elementPanelMap = new Map<string, number>();
  protected defaultDsReferencesMap = {
    panels: new Map<string, Set<string>>(), // refIds as keys
    variables: new Set<string>(), // variable names as keys
    annotations: new Set<string>(), // annotation names as keys
  };

  initializeElementMapping(saveModel: Dashboard | undefined) {
    this.elementPanelMap.clear();

    if (!saveModel || !saveModel.panels) {
      return;
    }
    saveModel.panels?.forEach((panel) => {
      if (panel.id) {
        const elementKey = getVizPanelKeyForPanelId(panel.id);
        this.elementPanelMap.set(elementKey, panel.id);
      }
    });
  }

  getElementPanelMapping() {
    return this.elementPanelMap;
  }

  initializeDSReferencesMapping(saveModel: Dashboard | undefined) {
    // To be implemented in a different PR
    return {};
  }

  getDSReferencesMapping() {
    return this.defaultDsReferencesMap;
  }

  getPanelIdForElement(elementId: string) {
    return this.elementPanelMap.get(elementId);
  }

  getElementIdForPanel(panelId: number) {
    // First try to find an existing mapping
    for (const [elementId, id] of this.elementPanelMap.entries()) {
      if (id === panelId) {
        return elementId;
      }
    }

    // For runtime-created panels, generate a new element identifier
    const newElementId = getVizPanelKeyForPanelId(panelId);
    // Store the new mapping for future lookups
    this.elementPanelMap.set(newElementId, panelId);
    return newElementId;
  }

  getSaveModel(s: DashboardScene) {
    return transformSceneToSaveModel(s);
  }

  getSaveAsModel(s: DashboardScene, options: SaveDashboardAsOptions) {
    const saveModel = this.getSaveModel(s);

    return {
      ...saveModel,
      id: null,
      uid: '',
      title: options.title || '',
      description: options.description || undefined,
      tags: options.isNew || options.copyTags ? saveModel.tags : [],
    };
  }

  getDashboardChangesFromScene(
    scene: DashboardScene,
    options: { saveTimeRange?: boolean; saveVariables?: boolean; saveRefresh?: boolean }
  ) {
    const changedSaveModel = this.getSaveModel(scene);
    const changeInfo = getRawDashboardChanges(
      this.initialSaveModel!,
      changedSaveModel,
      options.saveTimeRange,
      options.saveVariables,
      options.saveRefresh
    );

    const hasFolderChanges = scene.getInitialState()?.meta.folderUid !== scene.state.meta.folderUid;

    return {
      ...changeInfo,
      hasFolderChanges,
      hasChanges: changeInfo.hasChanges || hasFolderChanges,
      hasMigratedToV2: false,
    };
  }

  onSaveComplete(saveModel: Dashboard, result: SaveDashboardResponseDTO): void {
    this.initialSaveModel = {
      ...saveModel,
      id: result.id,
      uid: result.uid,
      version: result.version,
    };
    this.metadata = {
      ...this.metadata,
      k8s: {
        ...this.metadata?.k8s,
        generation: result.version,
      },
    };
  }

  getK8SMetadata() {
    return this.metadata?.k8s;
  }

  getTrackingInformation(): DashboardTrackingInfo | undefined {
    const panelTypes = this.initialSaveModel?.panels?.map((p) => p.type) || [];
    const panels = getPanelPluginCounts(panelTypes);
    const variables = getV1SchemaVariables(this.initialSaveModel?.templating?.list || []);

    if (this.initialSaveModel) {
      return {
        uid: this.initialSaveModel.uid,
        title: this.initialSaveModel.title,
        schemaVersion: this.initialSaveModel.schemaVersion,
        panels_count: this.initialSaveModel.panels?.length || 0,
        settings_nowdelay: undefined,
        settings_livenow: !!this.initialSaveModel.liveNow,
        ...panels,
        ...variables,
      };
    }
    return undefined;
  }

  getSnapshotUrl() {
    return this.initialSaveModel?.snapshot?.originalUrl;
  }

  async makeExportableExternally(s: DashboardScene) {
    const saveModel = this.getSaveModel(s);
    const oldModel = new DashboardModel(saveModel, undefined, {
      getVariablesFromState: () => {
        return getVariablesCompatibility(window.__grafanaSceneContext);
      },
    });
    return await makeExportableV1(oldModel);
  }
}

export class V2DashboardSerializer
  implements
    DashboardSceneSerializerLike<
      DashboardV2Spec,
      DashboardWithAccessInfo<DashboardV2Spec>['metadata'],
      Dashboard | DashboardV2Spec
    >
{
  initialSaveModel?: DashboardV2Spec | Dashboard;
  metadata?: DashboardWithAccessInfo<DashboardV2Spec>['metadata'];
  protected elementPanelMap = new Map<string, number>();
  // map of elementId that will contain all the queries, variables and annotations that dont have a ds defined
  protected defaultDsReferencesMap = {
    panels: new Map<string, Set<string>>(), // refIds as keys
    variables: new Set<string>(), // variable names as keys
    annotations: new Set<string>(), // annotation names as keys
  };

  getElementPanelMapping() {
    return this.elementPanelMap;
  }

  initializeElementMapping(saveModel: DashboardV2Spec | undefined) {
    this.elementPanelMap.clear();

    if (!saveModel || !saveModel.elements) {
      return;
    }

    const elementKeys = Object.keys(saveModel.elements);
    elementKeys.forEach((key) => {
      const elementPanel = saveModel.elements[key];
      if (elementPanel.kind === 'Panel') {
        this.elementPanelMap.set(key, elementPanel.spec.id);
      }
    });
  }

  initializeDSReferencesMapping(saveModel: DashboardV2Spec | undefined) {
    // The saveModel could be undefined or not a DashboardV2Spec
    // when dashboardsNewLayout is enabled, saveModel could be v1
    // in those cases, only when saving we will convert to v2
    if (saveModel === undefined || (saveModel && !isDashboardV2Spec(saveModel))) {
      return;
    }
    // initialize the object
    this.defaultDsReferencesMap = {
      panels: new Map<string, Set<string>>(),
      variables: new Set<string>(),
      annotations: new Set<string>(),
    };

    // get all the element keys
    const elementKeys = Object.keys(saveModel?.elements || {});
    elementKeys.forEach((key) => {
      const elementPanel = saveModel?.elements[key];
      if (elementPanel?.kind === 'Panel') {
        // check if the elementPanel.spec.datasource is defined
        const panelQueries = elementPanel.spec.data.spec.queries;

        for (const query of panelQueries) {
          if (!query.spec.query.datasource?.name) {
            const elementId = this.getElementIdForPanel(elementPanel.spec.id);
            if (!this.defaultDsReferencesMap.panels.has(elementId)) {
              this.defaultDsReferencesMap.panels.set(elementId, new Set());
            }

            const panelDsqueries = this.defaultDsReferencesMap.panels.get(elementId)!;

            panelDsqueries.add(query.spec.refId);
          }
        }
      }
    });

    // initialize autossigned variable ds references map
    if (saveModel?.variables) {
      for (const variable of saveModel.variables) {
        // for query variables that dont have a ds defined add them to the list
        if (variable.kind === 'QueryVariable' && !variable.spec.query.datasource?.name) {
          this.defaultDsReferencesMap.variables.add(variable.spec.name);
        }
      }
    }

    // initialize annotations ds references map
    if (saveModel?.annotations) {
      for (const annotation of saveModel.annotations) {
        if (!annotation.spec.query?.datasource?.name) {
          this.defaultDsReferencesMap.annotations.add(annotation.spec.name);
        }
      }
    }
  }

  getDSReferencesMapping() {
    return this.defaultDsReferencesMap;
  }

  getPanelIdForElement(elementId: string) {
    return this.elementPanelMap.get(elementId);
  }

  getElementIdForPanel(panelId: number) {
    // First try to find an existing mapping
    for (const [elementId, id] of this.elementPanelMap.entries()) {
      if (id === panelId) {
        return elementId;
      }
    }

    // For runtime-created panels, generate a new element identifier
    const newElementId = getVizPanelKeyForPanelId(panelId);
    // Store the new mapping for future lookups
    this.elementPanelMap.set(newElementId, panelId);
    return newElementId;
  }

  getSaveModel(s: DashboardScene) {
    return transformSceneToSaveModelSchemaV2(s);
  }

  getSaveAsModel(s: DashboardScene, options: SaveDashboardAsOptions) {
    const saveModel = this.getSaveModel(s);
    return {
      ...saveModel,
      title: options.title || '',
      description: options.description || '',
      tags: options.isNew || options.copyTags ? saveModel.tags : [],
    };
  }

  getDashboardChangesFromScene(
    scene: DashboardScene,
    options: { saveTimeRange?: boolean; saveVariables?: boolean; saveRefresh?: boolean }
  ) {
    const changedSaveModel = this.getSaveModel(scene);
    const changeInfo = getRawDashboardV2Changes(
      this.initialSaveModel!,
      changedSaveModel,
      options.saveTimeRange,
      options.saveVariables,
      options.saveRefresh
    );

    const hasFolderChanges = scene.getInitialState()?.meta.folderUid !== scene.state.meta.folderUid;
    const isNew = !Boolean(scene.getInitialState()?.uid);

    return {
      ...changeInfo,
      hasFolderChanges,
      hasChanges: changeInfo.hasChanges || hasFolderChanges,
      isNew,
      hasMigratedToV2: !!changeInfo.hasMigratedToV2,
    };
  }

  onSaveComplete(saveModel: DashboardV2Spec, result: SaveDashboardResponseDTO): void {
    this.initialSaveModel = {
      ...saveModel,
    };
    if (this.metadata) {
      this.metadata = {
        ...this.metadata,
        generation: result.version,
      };
    }
  }

  getK8SMetadata() {
    return this.metadata;
  }

  getTrackingInformation(s: DashboardScene): DashboardTrackingInfo | undefined {
    if (!this.initialSaveModel) {
      return undefined;
    }

    const panelPluginIds =
      'elements' in this.initialSaveModel
        ? Object.values(this.initialSaveModel.elements)
            .filter((e) => e.kind === 'Panel')
            .map((p) => p.spec.vizConfig.group)
        : [];
    const panels = getPanelPluginCounts(panelPluginIds);
    const variables =
      'variables' in this.initialSaveModel! ? getV2SchemaVariables(this.initialSaveModel.variables) : [];

    return {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      uid: s.state.uid,
      title: this.initialSaveModel.title,
      panels_count: panelPluginIds.length || 0,
      settings_nowdelay: undefined,
      settings_livenow: !!this.initialSaveModel.liveNow,
      ...panels,
      ...variables,
    };
  }

  getSnapshotUrl() {
    return this.metadata?.annotations?.[AnnoKeyDashboardSnapshotOriginalUrl];
  }

  async makeExportableExternally(s: DashboardScene) {
    return await makeExportableV2(this.getSaveModel(s));
  }
}

export function getDashboardSceneSerializer(): DashboardSceneSerializerLike<
  Dashboard,
  DashboardMeta,
  Dashboard,
  DashboardJson
>;
export function getDashboardSceneSerializer(
  version: 'v1'
): DashboardSceneSerializerLike<Dashboard, DashboardMeta, Dashboard, DashboardJson>;
export function getDashboardSceneSerializer(
  version: 'v2'
): DashboardSceneSerializerLike<
  DashboardV2Spec,
  DashboardWithAccessInfo<DashboardV2Spec>['metadata'],
  DashboardV2Spec,
  DashboardV2Spec
>;
export function getDashboardSceneSerializer(
  version?: 'v1' | 'v2'
): DashboardSceneSerializerLike<
  Dashboard | DashboardV2Spec,
  DashboardMeta | DashboardWithAccessInfo<DashboardV2Spec>['metadata'],
  Dashboard | DashboardV2Spec,
  DashboardJson | DashboardV2Spec
> {
  if (version === 'v2') {
    return new V2DashboardSerializer();
  }

  return new V1DashboardSerializer();
}
