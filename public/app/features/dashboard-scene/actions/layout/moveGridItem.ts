import { type SceneGridItemLike, type SceneObject, VizPanel } from '@grafana/scenes';

import { type DashboardDropTarget } from '../../scene/types/DashboardDropTarget';
import { moveElement } from '../element/moveElement';

interface MoveGridItemProps {
  source: DashboardDropTarget;
  destination: DashboardDropTarget;
  gridItem: SceneGridItemLike;
  originalIndex: number | null;
  destinationIndex?: number;
}

/**
 * Checked structurally (rather than `instanceof AutoGridItem`/`DashboardGridItem`) to avoid
 * importing those classes here: they pull in the whole dashboard-scene module graph, which
 * loops back through DashboardScene -> DashboardLayoutOrchestrator -> this file.
 */
function isGridItemWithPanel(item: SceneObject | undefined): item is SceneGridItemLike & { state: { body: VizPanel } } {
  return !!item && 'body' in item.state && item.state.body instanceof VizPanel;
}

/**
 * Moves a grid item from source to destination as a single undoable action.
 */
export function moveGridItem({
  source,
  destination,
  gridItem,
  originalIndex,
  destinationIndex,
}: MoveGridItemProps): void {
  if (!isGridItemWithPanel(gridItem)) {
    return;
  }
  const panel = gridItem.state.body;

  moveElement({
    source,
    movedObject: panel,
    // Dragging panels around shouldn't auto-select them: a user moving several panels in a row
    // would otherwise get the sidebar hijacked to the last one after every drop.
    selectOnMove: false,
    perform: () => {
      const currentWrapper = panel.parent;
      if (!isGridItemWithPanel(currentWrapper)) {
        return;
      }
      source.draggedGridItemOutside?.(currentWrapper);
      destination.draggedGridItemInside?.(currentWrapper, destinationIndex);
    },
    undo: () => {
      const currentWrapper = panel.parent;
      if (!isGridItemWithPanel(currentWrapper)) {
        return;
      }
      destination.draggedGridItemOutside?.(currentWrapper);
      source.draggedGridItemInside?.(currentWrapper, originalIndex ?? undefined);
    },
  });
}
