import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

import { useDeleteDashboardMutation, useDeleteFolderMutation } from '../../api/browseDashboardsAPI';
import { useActionSelectionState } from '../../state';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';

export interface Props {
  // this is a complete hack to force a full rerender.
  // TODO remove once we move everything to RTK query
  onActionComplete: () => void;
}

export function BrowseActions({ onActionComplete }: Props) {
  const styles = useStyles2(getStyles);
  const selectedItems = useActionSelectionState();
  const [deleteDashboard] = useDeleteDashboardMutation();
  const [deleteFolder] = useDeleteFolderMutation();
  const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);

  const onDelete = async () => {
    // Delete all the folders sequentially
    // TODO error handling here
    for (const folderUID of selectedFolders) {
      await deleteFolder(folderUID).unwrap();
    }

    // Delete all the dashboards sequenetially
    // TODO error handling here
    for (const dashboardUID of selectedDashboards) {
      await deleteDashboard(dashboardUID).unwrap();
    }
    onActionComplete();
  };

  const onMove = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: MoveModal,
        props: {
          selectedItems,
          onConfirm: (moveTarget: string) => {
            console.log(`MoveModal onConfirm clicked with target ${moveTarget}!`);
          },
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
      <Button onClick={onMove} variant="secondary">
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
