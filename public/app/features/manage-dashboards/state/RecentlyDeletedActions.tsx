import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { Button, useStyles2 } from '@grafana/ui';

import appEvents from '../../../core/app_events';
import { Trans } from '../../../core/internationalization';
import { useDispatch } from '../../../types';
import { ShowModalReactEvent } from '../../../types/events';
import { useRestoreDashboardMutation } from '../../browse-dashboards/api/browseDashboardsAPI';
import { setAllSelection, useActionSelectionState } from '../../browse-dashboards/state';
import { PermanentlyDeleteModal } from '../components/PermanentlyDeleteModal';
import { RestoreModal } from '../components/RestoreModal';
import { useRecentlyDeletedStateManager } from '../utils/useRecentlyDeletedStateManager';

export function RecentlyDeletedActions() {
  const styles = useStyles2(getStyles);

  const dispatch = useDispatch();
  const selectedItems = useActionSelectionState();
  const [, stateManager] = useRecentlyDeletedStateManager();

  const [restoreDashboard, { isLoading: isRestoreLoading }] = useRestoreDashboardMutation();

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    stateManager.doSearchWithDebounce();
  };

  const onRestore = async () => {
    const promises = Object.entries(selectedItems.dashboard)
      .filter(([_, selected]) => selected)
      .map(([uid]) => restoreDashboard({ dashboardUID: uid }));
    await Promise.all(promises);
    onActionComplete();
  };

  const showRestoreModal = () => {
    //TODO: Modal doesn't open
    appEvents.publish(
      new ShowModalReactEvent({
        component: RestoreModal,
        props: {
          //TODO: review the following
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
        component: PermanentlyDeleteModal,
        props: {
          selectedItems,
          onConfirm: onRestore,
          isLoading: isRestoreLoading,
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
