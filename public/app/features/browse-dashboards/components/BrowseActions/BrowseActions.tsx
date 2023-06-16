import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch, useSelector } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { useDeleteItemsMutation, useMoveItemsMutation } from '../../api/browseDashboardsAPI';
import { childrenByParentUIDSelector, rootItemsSelector, setAllSelection, useActionSelectionState } from '../../state';
import { DashboardTreeSelection } from '../../types';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';

export interface Props {}

export function BrowseActions() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  const selectedItems = useActionSelectionState();
  const rootItems = useSelector(rootItemsSelector);
  const childrenByParentUID = useSelector(childrenByParentUIDSelector);

  const [deleteItems] = useDeleteItemsMutation();
  const [moveItems] = useMoveItemsMutation();

  const [, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    if (isSearching) {
      // Redo search query
      stateManager.doSearchWithDebounce();
    }
  };

  const onDelete = async () => {
    await deleteItems({ selectedItems, rootItems: rootItems?.items ?? [], childrenByParentUID });

    trackAction('delete', selectedItems);
    onActionComplete();
  };

  const onMove = async (destinationUID: string) => {
    await moveItems({
      selectedItems,
      rootItems: rootItems?.items ?? [],
      childrenByParentUID,
      destinationUID,
    });
    trackAction('move', selectedItems);
    onActionComplete();
  };

  const showMoveModal = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: MoveModal,
        props: {
          selectedItems,
          onConfirm: onMove,
        },
      })
    );
  };

  const showDeleteModal = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: DeleteModal,
        props: {
          selectedItems,
          onConfirm: onDelete,
        },
      })
    );
  };

  return (
    <div className={styles.row} data-testid="manage-actions">
      <Button onClick={showMoveModal} variant="secondary">
        Move
      </Button>
      <Button onClick={showDeleteModal} variant="destructive">
        Delete
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  }),
});

type actionType = 'move' | 'delete';
const actionMap: Record<actionType, string> = {
  move: 'grafana_manage_dashboards_item_moved',
  delete: 'grafana_manage_dashboards_item_deleted',
};

function trackAction(action: actionType, selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>) {
  const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);

  reportInteraction(actionMap[action], {
    item_counts: {
      folder: selectedFolders.length,
      dashboard: selectedDashboards.length,
    },
    source: 'tree_actions',
  });
}
