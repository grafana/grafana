import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch, useSelector } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { useMoveFolderMutation } from '../../api/browseDashboardsAPI';
import { PAGE_SIZE, ROOT_PAGE_SIZE } from '../../api/services';
import {
  childrenByParentUIDSelector,
  deleteDashboard,
  deleteFolder,
  moveDashboard,
  refetchChildren,
  rootItemsSelector,
  setAllSelection,
  useActionSelectionState,
} from '../../state';
import { findItem } from '../../state/utils';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';

export interface Props {}

export function BrowseActions() {
  const styles = useStyles2(getStyles);
  const selectedItems = useActionSelectionState();
  const dispatch = useDispatch();
  const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
  const rootItems = useSelector(rootItemsSelector);
  const [moveFolder] = useMoveFolderMutation();
  const childrenByParentUID = useSelector(childrenByParentUIDSelector);
  const [, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();

  const onActionComplete = (parentsToRefresh: Set<string | undefined>) => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    if (isSearching) {
      // Redo search query
      stateManager.doSearchWithDebounce();
    } else {
      // Refetch parents
      for (const parentUID of parentsToRefresh) {
        dispatch(refetchChildren({ parentUID, pageSize: parentUID ? PAGE_SIZE : ROOT_PAGE_SIZE }));
      }
    }
  };

  const onDelete = async () => {
    const parentsToRefresh = new Set<string | undefined>();

    // Delete all the folders sequentially
    // TODO error handling here
    for (const folderUID of selectedFolders) {
      await dispatch(deleteFolder(folderUID));
      // find the parent folder uid and add it to parentsToRefresh
      const folder = findItem(rootItems?.items ?? [], childrenByParentUID, folderUID);
      parentsToRefresh.add(folder?.parentUID);
    }

    // Delete all the dashboards sequentially
    // TODO error handling here
    for (const dashboardUID of selectedDashboards) {
      await dispatch(deleteDashboard(dashboardUID));
      // find the parent folder uid and add it to parentsToRefresh
      const dashboard = findItem(rootItems?.items ?? [], childrenByParentUID, dashboardUID);
      parentsToRefresh.add(dashboard?.parentUID);
    }
    trackAction('delete', selectedDashboards, selectedFolders);
    onActionComplete(parentsToRefresh);
  };

  const onMove = async (destinationUID: string) => {
    const parentsToRefresh = new Set<string | undefined>();
    parentsToRefresh.add(destinationUID);

    // Move all the folders sequentially
    // TODO error handling here
    for (const folderUID of selectedFolders) {
      await moveFolder({ folderUID, destinationUID });
      // find the parent folder uid and add it to parentsToRefresh
      const folder = findItem(rootItems?.items ?? [], childrenByParentUID, folderUID);
      parentsToRefresh.add(folder?.parentUID);
    }

    // Move all the dashboards sequentially
    // TODO error handling here
    for (const dashboardUID of selectedDashboards) {
      await dispatch(moveDashboard({ dashboardUID, destinationUID }));
      // find the parent folder uid and add it to parentsToRefresh
      const dashboard = findItem(rootItems?.items ?? [], childrenByParentUID, dashboardUID);
      parentsToRefresh.add(dashboard?.parentUID);
    }
    trackAction('move', selectedDashboards, selectedFolders);
    onActionComplete(parentsToRefresh);
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

function trackAction(action: actionType, selectedDashboards: string[], selectedFolders: string[]) {
  reportInteraction(actionMap[action], {
    item_counts: {
      folder: selectedFolders.length,
      dashboard: selectedDashboards.length,
    },
    source: 'tree_actions',
  });
}
