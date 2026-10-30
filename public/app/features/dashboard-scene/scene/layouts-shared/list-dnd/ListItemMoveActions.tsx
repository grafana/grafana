import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';

import { RowItem } from '../../layout-rows/RowItem';
import { isUnifiedDragAndDropEnabled } from '../unifiedDragAndDrop';

import { getListOf, type ListItem, type ListLayout } from './listDnd';
import { canMoveListItem, moveListItem } from './moveListItem';

interface Props {
  item: ListItem;
}

/**
 * Move up and down buttons for a row, left and right for a tab, in the edit pane. They replace the keyboard
 * reordering that the old drag and drop engine had, and are only shown with the unified engine.
 */
export function ListItemMoveActions({ item }: Props) {
  if (!isUnifiedDragAndDropEnabled()) {
    return null;
  }
  const list = getListOf(item);
  return list ? <MoveButtons item={item} list={list} /> : null;
}

function MoveButtons({ item, list }: Props & { list: ListLayout }) {
  // Re-renders when the order changes, e.g. after a move or an undo
  list.useState();

  const isRow = item instanceof RowItem;
  const previousLabel = isRow
    ? t('dashboard.edit-pane.list-item.move-up', 'Move up')
    : t('dashboard.edit-pane.list-item.move-left', 'Move left');
  const nextLabel = isRow
    ? t('dashboard.edit-pane.list-item.move-down', 'Move down')
    : t('dashboard.edit-pane.list-item.move-right', 'Move right');

  return (
    <>
      <IconButton
        name={isRow ? 'arrow-up' : 'arrow-left'}
        size="md"
        tooltip={previousLabel}
        tooltipPlacement="bottom"
        disabled={!canMoveListItem(item, 'previous')}
        onClick={() => moveListItem(item, 'previous')}
      />
      <IconButton
        name={isRow ? 'arrow-down' : 'arrow-right'}
        size="md"
        tooltip={nextLabel}
        tooltipPlacement="bottom"
        disabled={!canMoveListItem(item, 'next')}
        onClick={() => moveListItem(item, 'next')}
      />
    </>
  );
}
