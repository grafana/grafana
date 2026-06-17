import { sceneGraph, type SceneObject, type SceneObjectState } from '@grafana/scenes';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import type { DashboardDropTarget } from 'app/features/dashboard-scene/scene/types/DashboardDropTarget';

export const getLayoutForObject = (
  object: DashboardDropTarget | SceneObject<SceneObjectState> | DashboardScene
): AutoGridLayoutManager | DefaultGridLayoutManager | null => {
  const gridManagerForObject = sceneGraph.findObject(
    object,
    (currentSceneObject) =>
      currentSceneObject instanceof AutoGridLayoutManager || currentSceneObject instanceof DefaultGridLayoutManager
  );
  if (
    gridManagerForObject instanceof AutoGridLayoutManager ||
    gridManagerForObject instanceof DefaultGridLayoutManager
  ) {
    return gridManagerForObject;
  }
  return null;
};
