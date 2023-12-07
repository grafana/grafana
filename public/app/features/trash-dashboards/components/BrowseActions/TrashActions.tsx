import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { setAllSelection, useActionSelectionState } from 'app/features/browse-dashboards/state';
import { useDispatch } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { useHardDeleteItemsMutation, useRestoreItemsMutation } from '../../api/trashDashboardsAPI';
import { useTrashStateManager } from '../../hooks/useTrashStateManager';

import { DeleteModal } from './DeleteModal';
import { RestoreModal } from './RestoreModal';

export function TrashActions() {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const selectedItems = useActionSelectionState();
  const [deleteItems, { isLoading: isDeleteLoading }] = useHardDeleteItemsMutation();
  const [restoreItems, { isLoading: isRestoreLoading }] = useRestoreItemsMutation();
  const [, stateManager] = useTrashStateManager();

  const isSearching = stateManager.hasSearchFilters();

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    if (isSearching) {
      stateManager.doSearchWithDebounce();
    }
  };

  const onHardDelete = async () => {
    await deleteItems({ selectedItems });
    onActionComplete();
  };

  const onRestore = async () => {
    await restoreItems({ selectedItems });
    onActionComplete();
  };

  const showMoveModal = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: RestoreModal,
        props: {
          selectedItems,
          onConfirm: onRestore,
          isLoading: isRestoreLoading,
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
          onConfirm: onHardDelete,
          isLoading: isDeleteLoading,
        },
      })
    );
  };

  return (
    <div className={styles.row} data-testid="manage-actions">
      <Button onClick={showMoveModal} variant="secondary">
        Restore
      </Button>
      <Button onClick={showDeleteModal} variant="destructive">
        Delete permanently
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
