import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useDispatch } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import {
  deleteDashboard,
  deleteFolder,
  moveDashboard,
  moveFolder,
  setAllSelection,
  useActionSelectionState,
} from '../../state';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';

export interface Props {}

export function BrowseActions() {
  const styles = useStyles2(getStyles);
  const selectedItems = useActionSelectionState();
  const dispatch = useDispatch();
  const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);

  const onActionComplete = () => {
    dispatch(
      setAllSelection({
        isSelected: false,
      })
    );
  };

  const onDelete = async () => {
    // Delete all the folders sequentially
    // TODO error handling here
    for (const folderUID of selectedFolders) {
      await dispatch(deleteFolder(folderUID));
    }

    // Delete all the dashboards sequenetially
    // TODO error handling here
    for (const dashboardUID of selectedDashboards) {
      await dispatch(deleteDashboard(dashboardUID));
    }
    onActionComplete();
  };

  const onMove = async (destinationUID: string) => {
    // Move all the folders sequentially
    // TODO error handling here
    for (const folderUID of selectedFolders) {
      await dispatch(moveFolder({ folderUID, destinationUID }));
    }

    // Move all the dashboards sequentially
    // TODO error handling here
    for (const dashboardUID of selectedDashboards) {
      await dispatch(moveDashboard({ dashboardUID, destinationUID }));
    }
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
