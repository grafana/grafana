import React from 'react';

import { Button } from '@grafana/ui';

import appEvents from '../../../core/app_events';
import { Trans } from '../../../core/internationalization';
import { useDispatch } from '../../../types';
import { ShowModalReactEvent } from '../../../types/events';
import { useRestoreDashboardMutation } from '../../browse-dashboards/api/browseDashboardsAPI';
import { setAllSelection, useActionSelectionState } from '../../browse-dashboards/state';
import { RestoreModal } from '../components/RestoreModal';
import { useRecentlyDeletedStateManager } from '../utils/useRecentlyDeletedStateManager';

export function RecentlyDeletedActions() {
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

  return (
    <Button onClick={showRestoreModal} variant="secondary">
      <Trans i18nKey="recently-deleted.buttons.restore">Restore</Trans>
    </Button>
  );
}
