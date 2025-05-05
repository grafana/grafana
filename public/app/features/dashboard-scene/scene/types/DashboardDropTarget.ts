import { SceneObject, VizPanel } from '@grafana/scenes';

export interface DashboardDropTarget extends SceneObject {
  isDashboardDropTarget: Readonly<true>;
  setIsDropTarget?(isDropTarget: boolean): void;
  draggedPanelOutside?(panel: VizPanel): void;
  draggedPanelInside?(panel: VizPanel): void;
}

export function isDashboardDropTarget(scene: SceneObject): scene is DashboardDropTarget {
  return 'isDashboardDropTarget' in scene && scene.isDashboardDropTarget === true;
}
