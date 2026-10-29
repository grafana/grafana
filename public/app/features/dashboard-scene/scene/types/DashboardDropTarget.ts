import { type SceneObject, type SceneGridItemLike } from '@grafana/scenes';

/** Data attribute used to identify auto grid items as drop targets */
export const AUTO_GRID_ITEM_DROP_TARGET_ATTR = 'data-auto-grid-item-drop-target';

/** Data attribute used to identify dashboard layout elements as drop targets */
export const DASHBOARD_DROP_TARGET_KEY_ATTR = 'data-dashboard-drop-target-key';

/** Grab offset and rendered size of the dragged grid item, captured when the drag starts */
export interface GridItemDragInfo {
  /** Offset from the pointer to the item's top-left corner, in pixels */
  offsetX: number;
  offsetY: number;
  /** Rendered size of the item, in pixels */
  width: number;
  height: number;
  /** Rendered width and column gap of the auto grid the item is dragged from, to size it for a custom grid */
  autoGrid?: { width: number; columnGap: number };
}

/** Position of one item in a grid layout, in grid units. `i` is the key of the item's panel. */
export interface LayoutSnapshotItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type LayoutSnapshotLayout = readonly LayoutSnapshotItem[];

/** Item positions of one layout before and after a cross-layout move */
export interface LayoutSnapshot {
  target: { applyLayout(layout: LayoutSnapshotLayout): void };
  /** Restored on undo */
  before: LayoutSnapshotLayout;
  /** Applied on do and redo */
  after: LayoutSnapshotLayout;
}

export interface DashboardDropTarget extends SceneObject {
  /** A layout can be a drop target only some of the time, e.g. the custom grid only while the new grid renders it */
  readonly isDashboardDropTarget: boolean;
  setIsDropTarget?(isDropTarget: boolean): void;
  draggedGridItemOutside?(gridItem: SceneGridItemLike): void;
  draggedGridItemInside?(gridItem: SceneGridItemLike, position?: number): void;
  /** Set the position where a placeholder should be shown for external drops */
  setDropPosition?(position: number | null): void;
  /** Called on every pointer move while a grid item from another layout is dragged over this target */
  onExternalDragOver?(gridItem: SceneGridItemLike, evt: PointerEvent, info: GridItemDragInfo): void;
  /** Called on every pointer move while a new panel from the Add pane is dragged over this target */
  onNewPanelDragOver?(evt: PointerEvent): void;
  /**
   * Called once a grid item from another layout, or a new panel, is no longer dragged over this target.
   * On a drop, after the item was added.
   */
  onExternalDragLeave?(): void;
  /** Commits a drag that started and ended in this target */
  commitDragWithin?(gridItem: SceneGridItemLike): void;
  /**
   * Positions of this target's items before and after a cross-layout move, read when the item is
   * dropped. They are applied on top of the move so the drop lands exactly where it was previewed
   * and undo restores the old layout.
   */
  getLayoutSnapshot?(role: 'source' | 'destination'): LayoutSnapshot | null;
}

export function isDashboardDropTarget(scene: SceneObject): scene is DashboardDropTarget {
  return 'isDashboardDropTarget' in scene && scene.isDashboardDropTarget === true;
}

/** Snapshots of the source and destination layouts of a cross-layout move, for the targets that provide them */
export function getLayoutSnapshots(source: DashboardDropTarget, destination: DashboardDropTarget): LayoutSnapshot[] {
  return [source.getLayoutSnapshot?.('source'), destination.getLayoutSnapshot?.('destination')].filter(
    (snapshot): snapshot is LayoutSnapshot => !!snapshot
  );
}
