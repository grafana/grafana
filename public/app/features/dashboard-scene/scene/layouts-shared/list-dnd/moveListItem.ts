import { isRepeatCloneOrChildOf } from '../../../utils/clone';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';

import { commitListDrop } from './commitListDrop';
import { getListOf, type ListItem } from './listDnd';

/** Up or left (`previous`), down or right (`next`) */
export type ListMoveDirection = 'previous' | 'next';

/** The item's index among the items of its list, and how many there are. Null when it can't be moved. */
function getPosition(item: ListItem) {
  const list = getListOf(item);
  if (!list || isRepeatCloneOrChildOf(item)) {
    return null;
  }
  const items: readonly ListItem[] = list instanceof RowsLayoutManager ? list.state.rows : list.state.tabs;
  const index = items.indexOf(item);
  return index === -1 ? null : { list, index, count: items.length };
}

/** Whether the item can move one place in that direction: not past either end of its list */
export function canMoveListItem(item: ListItem, direction: ListMoveDirection): boolean {
  const position = getPosition(item);
  if (!position) {
    return false;
  }
  return direction === 'previous' ? position.index > 0 : position.index < position.count - 1;
}

/**
 * Moves a row or tab one place within its list, as one undoable action. The keyboard alternative to dragging it:
 * the same commit as a drop at that place.
 */
export function moveListItem(item: ListItem, direction: ListMoveDirection): void {
  const position = getPosition(item);
  if (!position || !canMoveListItem(item, direction)) {
    return;
  }
  const { list, index } = position;
  // Drop indexes don't count the moved item, so one place on is the index of the neighbour
  commitListDrop(item, list, { kind: 'list', list, index: direction === 'previous' ? index - 1 : index + 1 });
}
