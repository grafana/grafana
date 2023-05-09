import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch, useSelector } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import {
  childrenByParentUIDSelector,
  deleteDashboard,
  deleteFolder,
  fetchChildren,
  moveDashboard,
  moveFolder,
  rootItemsSelector,
  setAllSelection,
  useActionSelectionState,
} from '../../state';
import { findItem } from '../../state/utils';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';

export interface Props {}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function BrowseActions() {
  const styles = useStyles2(getStyles);
  const selectedItems = useActionSelectionState();
  const dispatch = useDispatch();
  const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
  const rootItems = useSelector(rootItemsSelector);
  const childrenByParentUID = useSelector(childrenByParentUIDSelector);
  const [, stateManager] = useSearchStateManager();
  const isSearching = stateManager.hasSearchFilters();

  const onActionComplete = (parentsToRefresh: Set<string | undefined>) => {
    dispatch(
      setAllSelection({
        isSelected: false,
      })
    );
    if (isSearching) {
      // Redo search query
      stateManager.doSearchWithDebounce();
    } else {
      // Refetch parents
      for (const parentUID of parentsToRefresh) {
        dispatch(fetchChildren(parentUID));
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
      await wait(250);
      // find the parent folder uid and add it to parentsToRefresh
      const dashboard = findItem(rootItems?.items ?? [], childrenByParentUID, dashboardUID);
      parentsToRefresh.add(dashboard?.parentUID);
    }
    onActionComplete(parentsToRefresh);
  };

  const onMove = async (destinationUID: string) => {
    const parentsToRefresh = new Set<string | undefined>();
    parentsToRefresh.add(destinationUID);

    // Move all the folders sequentially
    // TODO error handling here
    for (const folderUID of selectedFolders) {
      await dispatch(moveFolder({ folderUID, destinationUID }));
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
