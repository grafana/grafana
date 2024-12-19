import { config } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { SaveDashboardAsOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { getV1SchemaPanelCounts, getV1SchemaVariables } from 'app/features/dashboard/utils/tracking';
import { SaveDashboardResponseDTO } from 'app/types';

import { getRawDashboardChanges, getRawDashboardV2Changes } from '../saving/getDashboardChanges';
import { DashboardChangeInfo } from '../saving/shared';
import { DashboardScene } from '../scene/DashboardScene';

import { transformSceneToSaveModel } from './transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

export interface DashboardSceneSerializerLike<T> {
  /**
   * The save model which the dashboard scene was originally created from
   */
  initialSaveModel?: T;
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
  getTrackingInformation: () => DashboardTrackingInfo | undefined;
}

interface DashboardTrackingInfo {
  uid?: string;
  title?: string;
  schemaVersion: number;
  version_before_migration?: number;
  panels_count: number;
  settings_nowdelay?: number;
  settings_livenow?: boolean;
}

export class V1DashboardSerializer implements DashboardSceneSerializerLike<Dashboard> {
  initialSaveModel?: Dashboard;

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
      description: options.description || '',
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
    const panels = getV1SchemaPanelCounts(this.initialSaveModel?.panels || []);
    const variables = getV1SchemaVariables(this.initialSaveModel?.templating?.list || []);

    if (this.initialSaveModel) {
      return {
        uid: this.initialSaveModel.uid,
        title: this.initialSaveModel.title,
        schemaVersion: this.initialSaveModel.schemaVersion,
        version_before_migration: this.initialSaveModel.version,
        panels_count: this.initialSaveModel.panels?.length || 0,
        settings_nowdelay: undefined,
        settings_livenow: !!this.initialSaveModel.liveNow,
        ...panels,
        ...variables,
      };
    }
    return undefined;
  }
}

export class V2DashboardSerializer implements DashboardSceneSerializerLike<DashboardV2Spec> {
  initialSaveModel?: DashboardV2Spec;

  getSaveModel(s: DashboardScene) {
    return transformSceneToSaveModelSchemaV2(s);
  }

  getSaveAsModel(s: DashboardScene, options: SaveDashboardAsOptions) {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line
    return {} as DashboardV2Spec;
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
    const isNew = scene.getInitialState()?.meta.isNew;

    return {
      ...changeInfo,
      hasFolderChanges,
      hasChanges: changeInfo.hasChanges || hasFolderChanges,
      isNew,
    };
  }

  onSaveComplete(saveModel: DashboardV2Spec, result: SaveDashboardResponseDTO): void {
    throw new Error('v2 schema: Method not implemented.');
  }

  getTrackingInformation() {
    throw new Error('v2 schema: Method not implemented.');
    return undefined;
  }
}

export function getDashboardSceneSerializer(): DashboardSceneSerializerLike<Dashboard | DashboardV2Spec> {
  if (config.featureToggles.useV2DashboardsAPI) {
    return new V2DashboardSerializer();
  }

  return new V1DashboardSerializer();
}
