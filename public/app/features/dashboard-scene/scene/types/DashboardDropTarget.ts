import { SceneObject, SceneGridItemLike } from '@grafana/scenes';

export interface DashboardDropTarget extends SceneObject {
  isDashboardDropTarget: Readonly<true>;
  setIsDropTarget?(isDropTarget: boolean): void;
  draggedGridItemOutside?(gridItem: SceneGridItemLike): void;
  draggedGridItemInside?(gridItem: SceneGridItemLike): void;
}

export function isDashboardDropTarget(scene: SceneObject): scene is DashboardDropTarget {
  return 'isDashboardDropTarget' in scene && scene.isDashboardDropTarget === true;
}
