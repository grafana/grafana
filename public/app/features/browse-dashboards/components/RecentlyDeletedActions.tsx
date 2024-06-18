import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { Button, useStyles2 } from '@grafana/ui';

import appEvents from '../../../core/app_events';
import { Trans } from '../../../core/internationalization';
import { useDispatch } from '../../../types';
import { ShowModalReactEvent } from '../../../types/events';
import { useHardDeleteDashboardMutation, useRestoreDashboardMutation } from '../api/browseDashboardsAPI';
import { useRecentlyDeletedStateManager } from '../api/useRecentlyDeletedStateManager';
import { setAllSelection, useActionSelectionState } from '../state';

import { PermanentlyDeleteModal } from './PermanentlyDeleteModal';
import { RestoreModal } from './RestoreModal';

export function RecentlyDeletedActions() {
  const styles = useStyles2(getStyles);

  const dispatch = useDispatch();
  const selectedItemsState = useActionSelectionState();
  const [, stateManager] = useRecentlyDeletedStateManager();

  const [restoreDashboard, { isLoading: isRestoreLoading }] = useRestoreDashboardMutation();
  const [deleteDashboard, { isLoading: isDeleteLoading }] = useHardDeleteDashboardMutation();

  const selectedDashboards = useMemo(() => {
    return Object.entries(selectedItemsState.dashboard)
      .filter(([_, selected]) => selected)
      .map(([uid]) => uid);
  }, [selectedItemsState.dashboard]);

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    stateManager.doSearchWithDebounce();
  };

  const onRestore = async () => {
    const promises = selectedDashboards.map((uid) => restoreDashboard({ dashboardUID: uid }));

    await Promise.all(promises);
    onActionComplete();
  };

  const onDelete = async () => {
    const promises = selectedDashboards.map((uid) => deleteDashboard({ dashboardUID: uid }));

    await Promise.all(promises);
    onActionComplete();
  };

  const showRestoreModal = () => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: RestoreModal,
        props: {
          selectedDashboards,
          onConfirm: onRestore,
          isLoading: isRestoreLoading,
        },
      })
    );
  };

  const showDeleteModal = () => {
    //TODO: Modal doesn't open
    appEvents.publish(
      new ShowModalReactEvent({
        component: PermanentlyDeleteModal,
        props: {
          //TODO: review the following
          selectedDashboards,
          onConfirm: onDelete,
          isLoading: isDeleteLoading,
        },
      })
    );
  };

  return (
    <div className={styles.row}>
      <Button onClick={showRestoreModal} variant="secondary">
        <Trans i18nKey="recently-deleted.buttons.restore">Restore</Trans>
      </Button>
      <Button onClick={showDeleteModal} variant="destructive">
        <Trans i18nKey="recently-deleted.buttons.delete">Delete permanently</Trans>
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
