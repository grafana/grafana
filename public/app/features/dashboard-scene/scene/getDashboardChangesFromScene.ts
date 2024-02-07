import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { DashboardScene } from './DashboardScene';
import { getDashboardChanges } from './getDashboardChanges';

export function getDashboardChangesFromScene(scene: DashboardScene, saveTimeRange?: boolean, saveVariables?: boolean) {
  const changeInfo = getDashboardChanges(
    scene.getInitialSaveModel()!,
    transformSceneToSaveModel(scene),
    saveTimeRange,
    saveVariables
  );
  return changeInfo;
}
