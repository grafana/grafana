import React from 'react';

import { Button } from '@grafana/ui';

import appEvents from '../../../core/app_events';
import { useDispatch } from '../../../types';
import { ShowModalReactEvent } from '../../../types/events';
import { setAllSelection, useActionSelectionState } from '../../browse-dashboards/state';
import { useRestoreItemsMutation } from '../api/restoreDashboardsAPI';
import { RestoreModal } from '../components/RestoreModal';
import { useRecentlyDeletedStateManager } from '../utils/useRecentlyDeletedStateManager';

export function RecentlyDeletedAction() {
  const dispatch = useDispatch();
  const selectedItems = useActionSelectionState();
  const [, stateManager] = useRecentlyDeletedStateManager();
  const isSearching = stateManager.hasSearchFilters();

  const [restoreItems, { isLoading: isRestoreLoading }] = useRestoreItemsMutation();

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    if (isSearching) {
      stateManager.doSearchWithDebounce();
    }
  };

  const onRestore = async () => {
    await restoreItems({ selectedItems });
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
      {/*TODO: add Trans tag for i18n*/}
      Restore
    </Button>
  );
}
