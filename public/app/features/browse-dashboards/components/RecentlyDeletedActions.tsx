import { useMemo, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { buildNotificationButton } from 'app/core/components/AppNotifications/NotificationButton';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { useDispatch } from 'app/types/store';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';
import { useRestoreDashboardMutation } from '../api/browseDashboardsAPI';
import { useRecentlyDeletedStateManager } from '../api/useRecentlyDeletedStateManager';
import { useActionSelectionState } from '../state/hooks';
import { clearFolders, setAllSelection } from '../state/slice';
import { getRestoreNotificationData } from '../utils/notifications';

import { RestoreModal } from './RestoreModal';

export function RecentlyDeletedActions() {
  const dispatch = useDispatch();
  const selectedItemsState = useActionSelectionState();
  const [searchState, stateManager] = useRecentlyDeletedStateManager();
  const [restoreDashboard] = useRestoreDashboardMutation();
  const [isBulkRestoreLoading, setIsBulkRestoreLoading] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

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

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    if (error) {
      return JSON.stringify(error);
    }
    return '';
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
    const failed: Array<{ uid: string; error: string }> = [];

    results.forEach((result, index) => {
      const dashboardUid = selectedDashboards[index];
      if (result.status === 'rejected') {
        const errorMessage = getErrorMessage(result.reason);
        if (errorMessage) {
          failed.push({ uid: dashboardUid, error: errorMessage });
        }
      } else if (result.value.error) {
        const errorMessage = getErrorMessage(result.value.error);
        if (errorMessage) {
          failed.push({ uid: dashboardUid, error: errorMessage });
        }
      } else if ('data' in result.value && result.value.data?.name) {
        // Track the UID of successfully restored dashboards
        successful.push(dashboardUid);
      }
    });

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
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    deletedDashboardsCache.clear();
    await stateManager.doSearch();

    const notificationData = getRestoreNotificationData(successful, failed, restoreTarget);
    if (notificationData) {
      if (notificationData.kind === 'action') {
        const component = buildNotificationButton({
          buttonLabel: notificationData.data.buttonLabel,
          href: notificationData.data.targetUrl,
        });
        dispatch(notifyApp(createSuccessNotification(notificationData.data.title, '', undefined, component)));
      } else {
        appEvents.publish({
          type: notificationData.data.alertType,
          payload: [notificationData.data.message],
        });
      }
    }
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
