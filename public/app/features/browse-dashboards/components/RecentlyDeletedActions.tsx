import { useMemo } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';

import appEvents from '../../../core/app_events';
import { Trans } from '../../../core/internationalization';
import { useDispatch } from '../../../types';
import { ShowModalReactEvent } from '../../../types/events';
import { useHardDeleteDashboardMutation, useRestoreDashboardMutation } from '../api/browseDashboardsAPI';
import { useRecentlyDeletedStateManager } from '../api/useRecentlyDeletedStateManager';
import { clearFolders, setAllSelection, useActionSelectionState } from '../state';

import { PermanentlyDeleteModal } from './PermanentlyDeleteModal';
import { RestoreModal } from './RestoreModal';

export function RecentlyDeletedActions() {
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
    const resultsView = stateManager.state.result?.view.toArray();
    if (!resultsView) {
      return;
    }

    const promises = selectedDashboards.map((uid) => {
      return restoreDashboard({ dashboardUID: uid });
    });

    await Promise.all(promises);

    const parentUIDs = new Set<string | undefined>();
    for (const uid of selectedDashboards) {
      const foundItem = resultsView.find((v) => v.uid === uid);
      if (!foundItem) {
        continue;
      }

      // Search API returns items with no parent with a location of 'general', so we
      // need to convert that back to undefined
      const folderUID = foundItem.location === GENERAL_FOLDER_UID ? undefined : foundItem.location;
      parentUIDs.add(folderUID);
    }
    dispatch(clearFolders(Array.from(parentUIDs)));

    onActionComplete();
  };

  const onDelete = async () => {
    const promises = selectedDashboards.map((uid) => deleteDashboard({ dashboardUID: uid }));

    await Promise.all(promises);
    onActionComplete();
  };

  const showRestoreModal = () => {
    reportInteraction('grafana_restore_clicked', {
      item_counts: {
        dashboard: selectedDashboards.length,
      },
    });
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
    reportInteraction('grafana_delete_permanently_clicked', {
      item_counts: {
        dashboard: selectedDashboards.length,
      },
    });
    appEvents.publish(
      new ShowModalReactEvent({
        component: PermanentlyDeleteModal,
        props: {
          selectedDashboards,
          onConfirm: onDelete,
          isLoading: isDeleteLoading,
        },
      })
    );
  };

  return (
    <Stack gap={1}>
      <Button onClick={showRestoreModal} variant="secondary">
        <Trans i18nKey="recently-deleted.buttons.restore">Restore</Trans>
      </Button>
      <Button onClick={showDeleteModal} variant="destructive">
        <Trans i18nKey="recently-deleted.buttons.delete">Delete permanently</Trans>
      </Button>
    </Stack>
  );
}
