import { config } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { AnnoKeyDashboardSnapshotOriginalUrl } from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { SaveDashboardAsOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { DASHBOARD_SCHEMA_VERSION } from 'app/features/dashboard/state/DashboardMigrator';
import {
  getPanelPluginCounts,
  getV1SchemaVariables,
  getV2SchemaVariables,
} from 'app/features/dashboard/utils/tracking';
import { DashboardMeta, SaveDashboardResponseDTO } from 'app/types';

import { getRawDashboardChanges, getRawDashboardV2Changes } from '../saving/getDashboardChanges';
import { DashboardChangeInfo } from '../saving/shared';
import { DashboardScene } from '../scene/DashboardScene';

import { transformSceneToSaveModel } from './transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

export interface DashboardSceneSerializerLike<T, M> {
  /**
   * The save model which the dashboard scene was originally created from
   */
  initialSaveModel?: T;
  metadata?: M;
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
}

interface DashboardTrackingInfo {
  uid?: string;
  title?: string;
  schemaVersion: number;
  panels_count: number;
  settings_nowdelay?: number;
  settings_livenow?: boolean;
}

export class V1DashboardSerializer implements DashboardSceneSerializerLike<Dashboard, DashboardMeta> {
  initialSaveModel?: Dashboard;
  metadata?: DashboardMeta;

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
    };
  }

  onSaveComplete(saveModel: Dashboard, result: SaveDashboardResponseDTO): void {
    this.initialSaveModel = {
      ...saveModel,
      id: result.id,
      uid: result.uid,
      version: result.version,
    };
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
}

export class V2DashboardSerializer
  implements DashboardSceneSerializerLike<DashboardV2Spec, DashboardWithAccessInfo<DashboardV2Spec>['metadata']>
{
  initialSaveModel?: DashboardV2Spec;
  metadata?: DashboardWithAccessInfo<DashboardV2Spec>['metadata'];

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
    };
  }

  onSaveComplete(saveModel: DashboardV2Spec, result: SaveDashboardResponseDTO): void {
    this.initialSaveModel = {
      ...saveModel,
    };
  }

  getTrackingInformation(s: DashboardScene): DashboardTrackingInfo | undefined {
    const panelPluginIds =
      Object.values(this.initialSaveModel?.elements ?? [])
        .filter((e) => e.kind === 'Panel')
        .map((p) => p.spec.vizConfig.kind) || [];
    const panels = getPanelPluginCounts(panelPluginIds);
    const variables = getV2SchemaVariables(this.initialSaveModel?.variables || []);

    if (this.initialSaveModel) {
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

    return undefined;
  }

  getSnapshotUrl() {
    return this.metadata?.annotations?.[AnnoKeyDashboardSnapshotOriginalUrl];
  }
}

export function getDashboardSceneSerializer(): DashboardSceneSerializerLike<
  Dashboard | DashboardV2Spec,
  DashboardMeta | DashboardWithAccessInfo<DashboardV2Spec>['metadata']
> {
  if (config.featureToggles.useV2DashboardsAPI) {
    return new V2DashboardSerializer();
  }

  return new V1DashboardSerializer();
}
