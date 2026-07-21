import { useMemo, useState } from 'react';

import { Trans } from '@grafana/i18n';
import { logMeasurement, logWarning, reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { buildNotificationButton } from 'app/core/components/AppNotifications/NotificationButton';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { getStatusFromError } from 'app/core/utils/errors';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { isRootFolderUID } from 'app/features/search/constants';
import { useDispatch } from 'app/types/store';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';
import { useRestoreDashboardMutation } from '../api/browseDashboardsAPI';
import { useRecentlyDeletedStateManager } from '../api/useRecentlyDeletedStateManager';
import { useActionSelectionState } from '../state/hooks';
import { clearFolders, setAllSelection } from '../state/slice';
import { getRestoreNotificationData, RESTORE_FETCH_NOT_FOUND } from '../utils/notifications';

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
    if (!searchState.result || selectedDashboards.length === 0) {
      return undefined;
    }

    let originCandidate: string | undefined;
    for (const selectedDashboard of selectedDashboards) {
      const index = searchState.result.view.fields.uid.values.findIndex((e) => e === selectedDashboard);
      if (index === -1) {
        return undefined;
      }

      // Searcher reports root-parented items with the "general" UID, but the
      // restore API doesn't accept it — convert back to "" so the dashboard
      // is restored to the root.
      const location = searchState.result.view.fields.location.values[index];
      const fixedLocation = isRootFolderUID(location) ? '' : location;

      if (originCandidate === undefined) {
        originCandidate = fixedLocation;
        continue;
      }

      if (originCandidate !== fixedLocation) {
        return undefined;
      }
    }

    return originCandidate;
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
      const api = await getDashboardAPI();
      const dashboard = await api.getDeletedDashboard(uid);
      if (!dashboard) {
        // The recently-deleted listing is deleter/permission-aware: empty result means
        // this user cannot read the deleted dashboard (or it is no longer recently deleted).
        logWarning('Deleted dashboard not visible in the recently-deleted listing during restore', { uid });
        return { uid, error: RESTORE_FETCH_NOT_FOUND, step: 'fetch' as const };
      }

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
    const failed: Array<{ uid: string; error: string; status?: number; step: 'fetch' | 'create' }> = [];

    results.forEach((result, index) => {
      const dashboardUid = selectedDashboards[index];
      if (result.status === 'rejected') {
        // Rejections come from the recently-deleted listing fetch — the read path of the
        // restore pipeline.
        failed.push({
          uid: dashboardUid,
          error: getErrorMessage(result.reason),
          status: getStatusFromError(result.reason),
          step: 'fetch',
        });
      } else if (result.value.error) {
        failed.push({
          uid: dashboardUid,
          error: getErrorMessage(result.value.error),
          status: getStatusFromError(result.value.error),
          step: 'step' in result.value ? result.value.step : 'create',
        });
      } else {
        // Every settled promise lands in exactly one bucket: an empty error
        // message or an untitled dashboard must not fall through, or the
        // measurement below and the deletedDashboardsCache cleanup drift out of sync.
        successful.push(dashboardUid);
      }
    });

    // Outcome telemetry for the restore flow: failures are caught and surfaced
    // only as a toast, so this measurement is the only regression signal
    // (PIR follow-up for #127601, removable once FEP ships wider coverage).
    const errorStatusCodes = [...new Set(failed.map((f) => f.status?.toString() ?? 'unknown'))].join(',');
    const failedSteps = [...new Set(failed.map((f) => f.step))].join(',');
    logMeasurement(
      'browse_dashboards.restore_result',
      {
        total_count: selectedDashboards.length,
        success_count: successful.length,
        failure_count: failed.length,
      },
      {
        status: failed.length === 0 ? 'success' : successful.length === 0 ? 'failure' : 'partial_failure',
        error_status_codes: errorStatusCodes, // e.g. '404' | '404,500' | 'unknown' | ''
        failed_steps: failedSteps, // e.g. 'fetch' | 'fetch,create' | ''
      }
    );

    const parentUIDs = new Set<string | undefined>();
    for (const uid of selectedDashboards) {
      const foundItem = resultsView.find((v) => v.uid === uid);
      if (!foundItem) {
        continue;
      }
      // Search API reports root-parented items with the "general" UID —
      // convert that back to undefined.
      const folderUID = isRootFolderUID(foundItem.location) ? undefined : foundItem.location;
      parentUIDs.add(folderUID);
    }
    dispatch(clearFolders(Array.from(parentUIDs)));
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    deletedDashboardsCache.removeItems(successful);
    await stateManager.doSearch();

    const notificationData = getRestoreNotificationData(successful, failed, restoreTarget);
    if (notificationData) {
      if (notificationData.kind === 'action') {
        const component = buildNotificationButton({
          title: notificationData.data.title,
          buttonLabel: notificationData.data.buttonLabel,
          href: notificationData.data.targetUrl,
        });
        dispatch(notifyApp(createSuccessNotification('', '', undefined, component)));
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
      {isRestoreModalOpen && (
        <RestoreModal
          onConfirm={onRestore}
          onDismiss={() => setIsRestoreModalOpen(false)}
          selectedDashboards={selectedDashboards}
          originCandidate={selectedDashboardOrigin}
          isLoading={isBulkRestoreLoading}
        />
      )}
    </>
  );
}
