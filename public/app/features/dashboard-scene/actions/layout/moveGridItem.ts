import { type SceneGridItemLike, VizPanel } from '@grafana/scenes';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
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
 * Moves a grid item from source to destination as a single undoable action.
 */
export function moveGridItem({
  source,
  destination,
  gridItem,
  originalIndex,
  destinationIndex,
}: MoveGridItemProps): void {
  if (!(gridItem instanceof AutoGridItem || gridItem instanceof DashboardGridItem)) {
    return;
  }
  const panel = gridItem.state.body;
  if (!(panel instanceof VizPanel)) {
    return;
  }

  moveElement({
    source,
    movedObject: panel,
    // Dragging panels around shouldn't auto-select them: a user moving several panels in a row
    // would otherwise get the sidebar hijacked to the last one after every drop.
    selectOnMove: false,
    perform: () => {
      const currentWrapper = panel.parent;
      if (!(currentWrapper instanceof AutoGridItem || currentWrapper instanceof DashboardGridItem)) {
        return;
      }
      source.draggedGridItemOutside?.(currentWrapper);
      destination.draggedGridItemInside?.(currentWrapper, destinationIndex);
    },
    undo: () => {
      const currentWrapper = panel.parent;
      if (!(currentWrapper instanceof AutoGridItem || currentWrapper instanceof DashboardGridItem)) {
        return;
      }
      destination.draggedGridItemOutside?.(currentWrapper);
      source.draggedGridItemInside?.(currentWrapper, originalIndex ?? undefined);
    },
  });
}
