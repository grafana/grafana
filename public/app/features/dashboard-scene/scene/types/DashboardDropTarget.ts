import { SceneObject, SceneGridItemLike } from '@grafana/scenes';

/** Data attribute used to identify auto grid items as drop targets */
export const AUTO_GRID_ITEM_DROP_TARGET_ATTR = 'data-auto-grid-item-drop-target';

/** Data attribute used to identify dashboard layout elements as drop targets */
export const DASHBOARD_DROP_TARGET_KEY_ATTR = 'data-dashboard-drop-target-key';

export interface DashboardDropTarget extends SceneObject {
  isDashboardDropTarget: Readonly<true>;
  setIsDropTarget?(isDropTarget: boolean): void;
  draggedGridItemOutside?(gridItem: SceneGridItemLike): void;
  draggedGridItemInside?(gridItem: SceneGridItemLike, position?: number): void;
  /** Set the position where a placeholder should be shown for external drops */
  setDropPosition?(position: number | null): void;
}

export function isDashboardDropTarget(scene: SceneObject): scene is DashboardDropTarget {
  return 'isDashboardDropTarget' in scene && scene.isDashboardDropTarget === true;
}
