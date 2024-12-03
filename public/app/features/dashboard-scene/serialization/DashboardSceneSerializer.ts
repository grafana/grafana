import { config } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { SaveDashboardAsOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { SaveDashboardResponseDTO } from 'app/types';

import { getRawDashboardChanges } from '../saving/getDashboardChanges';
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
}

export class V2DashboardSerializer implements DashboardSceneSerializerLike<DashboardV2Spec> {
  initialSaveModel?: DashboardV2Spec;

  getSaveModel(s: DashboardScene) {
    return transformSceneToSaveModelSchemaV2(s) as DashboardV2Spec;
  }

  getSaveAsModel(s: DashboardScene, options: SaveDashboardAsOptions) {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line
    return {} as DashboardV2Spec;
  }

  getDashboardChangesFromScene(scene: DashboardScene) {
    throw new Error('v2 schema: Method not implemented.');
    // return getRawDashboardV2Changes(initialSaveModel, changedSaveModel, saveTimeRange, saveVariables, saveRefresh);
    // eslint-disable-next-line
    return {} as DashboardChangeInfo;
  }

  onSaveComplete(saveModel: DashboardV2Spec, result: SaveDashboardResponseDTO): void {
    throw new Error('v2 schema: Method not implemented.');
  }
}

export function getDashboardSceneSerializer(
  forceLegacy?: boolean
): DashboardSceneSerializerLike<Dashboard | DashboardV2Spec> {
  if (forceLegacy) {
    return new V1DashboardSerializer();
  }

  if (config.featureToggles.dashboardSchemaV2) {
    return new V2DashboardSerializer();
  }

  return new V1DashboardSerializer();
}
