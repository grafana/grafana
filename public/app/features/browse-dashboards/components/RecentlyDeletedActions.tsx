import { useMemo, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { useDispatch } from 'app/types/store';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';
import { useRestoreDashboardMutation } from '../api/browseDashboardsAPI';
import { useRecentlyDeletedStateManager } from '../api/useRecentlyDeletedStateManager';
import { useActionSelectionState } from '../state/hooks';
import { clearFolders, setAllSelection } from '../state/slice';

import { RestoreModal } from './RestoreModal';

export function RecentlyDeletedActions() {
  const dispatch = useDispatch();
  const selectedItemsState = useActionSelectionState();
  const [searchState, stateManager] = useRecentlyDeletedStateManager();
  const [restoreDashboard] = useRestoreDashboardMutation();
  const [isBulkRestoreLoading, setIsBulkRestoreLoading] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const showRestoreNotifications = (successful: string[], failedCount: number) => {
    const successCount = successful.length;

    if (successCount === 0 && failedCount === 0) {
      return;
    }

    let alertType = AppEvents.alertSuccess.name;
    let message = t('browse-dashboards.restore.success', 'Dashboards restored successfully');

    if (failedCount > 0) {
      if (successCount > 0) {
        // Partial success
        alertType = AppEvents.alertWarning.name;
        const successMessage = t(
          'browse-dashboards.restore.success-count',
          '{{count}} dashboard restored successfully',
          { count: successCount }
        );
        const failedMessage = t('browse-dashboards.restore.failed-count', '{{count}} dashboard failed', {
          count: failedCount,
        });
        message = `${successMessage}. ${failedMessage}.`;
      } else {
        // All failed
        alertType = AppEvents.alertError.name;
        message = t('browse-dashboards.restore.all-failed', 'Failed to restore {{count}} dashboard', {
          count: failedCount,
        });
      }
    }

    appEvents.publish({
      type: alertType,
      payload: [message],
    });
  };

  const selectedDashboards = useMemo(() => {
    return Object.entries(selectedItemsState.dashboard)
      .filter(([_, selected]) => selected)
      .map(([uid]) => uid);
  }, [selectedItemsState.dashboard]);

  const selectedDashboardOrigin = useMemo(() => {
    if (!searchState.result) {
      return [];
    }

    const origins: string[] = [];
    for (const selectedDashboard of selectedDashboards) {
      const index = searchState.result.view.fields.uid.values.findIndex((e) => e === selectedDashboard);

      // SQLSearcher changes the location from empty string to 'general' for items with no parent,
      // but the restore API doesn't work with 'general' folder UID, so we need to convert it back
      // to an empty string
      const location = searchState.result.view.fields.location.values[index];
      const fixedLocation = location === GENERAL_FOLDER_UID ? '' : location;
      origins.push(fixedLocation);
    }
    return origins;
  }, [selectedDashboards, searchState.result]);

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    deletedDashboardsCache.clear();
    stateManager.doSearchWithDebounce();
  };

  const onRestore = async (restoreTarget: string) => {
    const resultsView = stateManager.state.result?.view.toArray();
    if (!resultsView) {
      return;
    }

    setIsBulkRestoreLoading(true);

    const promises = selectedDashboards.map(async (uid) => {
      const deletedDashboards = await deletedDashboardsCache.getAsResourceList();
      const dashboard = deletedDashboards?.items.find((d) => d.metadata.name === uid);
      if (!dashboard) {
        console.warn(`Dashboard ${uid} not found in deleted items`);
        return { uid, error: 'not_found' };
      }
      // Clone the dashboard to be able to edit the immutable data from the store
      const copy = structuredClone(dashboard);
      copy.metadata = {
        ...copy.metadata,
        annotations: { ...copy.metadata?.annotations, [AnnoKeyFolder]: restoreTarget },
      };

      return restoreDashboard({ dashboard: copy });
    });

    const results = await Promise.allSettled(promises);

    // Separate successful and failed restores
    const successful: string[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      const dashboardUid = selectedDashboards[index];
      if (result.status === 'rejected') {
        failed.push(dashboardUid);
      } else if (result.value.error) {
        failed.push(dashboardUid);
      } else if ('data' in result.value && result.value.data?.name) {
        successful.push(result.value.data.name);
      }
    });

    // Show consolidated notification
    const failedCount = failed.length;
    showRestoreNotifications(successful, failedCount);

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
    setIsBulkRestoreLoading(false);
    setIsRestoreModalOpen(false);
  };

  const showRestoreModal = () => {
    reportInteraction('grafana_restore_clicked', {
      item_counts: {
        dashboard: selectedDashboards.length,
      },
    });
    setIsRestoreModalOpen(true);
  };

  return (
    <>
      <Stack gap={1}>
        <Button onClick={showRestoreModal} variant="secondary">
          <Trans i18nKey="recently-deleted.buttons.restore">Restore</Trans>
        </Button>
      </Stack>
      <RestoreModal
        isOpen={isRestoreModalOpen}
        onConfirm={onRestore}
        onDismiss={() => setIsRestoreModalOpen(false)}
        selectedDashboards={selectedDashboards}
        dashboardOrigin={selectedDashboardOrigin}
        isLoading={isBulkRestoreLoading}
      />
    </>
  );
}
