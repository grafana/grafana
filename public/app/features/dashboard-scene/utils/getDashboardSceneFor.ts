import type { SceneObject } from '@grafana/scenes';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

export function getDashboardSceneFor(sceneObject: SceneObject): DashboardScene {
  const root = sceneObject.getRoot();

  if ('onEnterEditMode' in root) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return <DashboardScene>root;
  }

  throw new Error('SceneObject root is not a DashboardScene');
}
