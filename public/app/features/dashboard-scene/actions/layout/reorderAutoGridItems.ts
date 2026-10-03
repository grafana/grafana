import { type AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { type AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { ObjectsReorderedOnCanvasEvent } from '../../sidebar/events';
import { moveElement } from '../element/moveElement';

interface ReorderAutoGridItemsProps {
  layout: AutoGridLayout;
  movedItem: AutoGridItem;
  fromIndex: number;
  toIndex: number;
}

export function moveToIndex(children: AutoGridItem[], panelKey: string, index: number): AutoGridItem[] {
  const current = children.find((child) => child.state.body.state.key === panelKey);
  if (!current) {
    return children;
  }

  const rest = children.filter((child) => child !== current);
  rest.splice(Math.min(index, rest.length), 0, current);
  return rest;
}

/**
 * Records a single undoable move covering a whole drag gesture that reordered panels within one
 * AutoGridLayout, from the index before the drag to the index after.
 */
export function reorderAutoGridItems({ layout, movedItem, fromIndex, toIndex }: ReorderAutoGridItemsProps): void {
  if (fromIndex === toIndex) {
    return;
  }

  const panelKey = movedItem.state.body.state.key!;

  moveElement({
    source: layout,
    movedObject: movedItem.state.body,
    // Dragging panels around shouldn't auto-select them: a user moving several panels in a row
    // would otherwise get the sidebar hijacked to the last one after every drop.
    selectOnMove: false,
    perform: () => {
      layout.setState({ children: moveToIndex(layout.state.children, panelKey, toIndex) });
      layout.publishEvent(new ObjectsReorderedOnCanvasEvent(layout), true);
    },
    undo: () => {
      layout.setState({ children: moveToIndex(layout.state.children, panelKey, fromIndex) });
      layout.publishEvent(new ObjectsReorderedOnCanvasEvent(layout), true);
    },
  });
}
