import { type AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { type AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { moveElement } from '../element/moveElement';

interface ReorderAutoGridItemsProps {
  layout: AutoGridLayout;
  movedItem: AutoGridItem;
  fromChildren: AutoGridItem[];
  toChildren: AutoGridItem[];
}

/**
 * Records a single undoable move covering a whole drag gesture that reordered panels within one
 * AutoGridLayout, from the order before the drag to the order after.
 */
export function reorderAutoGridItems({ layout, movedItem, fromChildren, toChildren }: ReorderAutoGridItemsProps): void {
  const changed = fromChildren.length !== toChildren.length || fromChildren.some((child, i) => child !== toChildren[i]);

  if (!changed) {
    return;
  }

  moveElement({
    source: layout,
    movedObject: movedItem.state.body,
    perform: () => {
      layout.setState({ children: toChildren });
      layout.publishEvent(new ObjectsReorderedOnCanvasEvent(layout), true);
    },
    undo: () => {
      layout.setState({ children: fromChildren });
      layout.publishEvent(new ObjectsReorderedOnCanvasEvent(layout), true);
    },
  });
}
