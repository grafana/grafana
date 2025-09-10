import { useMemo } from 'react';

import { AppEvents } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { ShowModalReactEvent } from 'app/types/events';
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
  const [restoreDashboard, { isLoading: isRestoreLoading }] = useRestoreDashboardMutation();

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

    // Count failures from both rejected promises and RTK Query errors
    const failures = results.filter(
      (result) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error)
    );

    const failedCount = failures.length;
    if (failedCount > 0) {
      const totalCount = results.length;
      appEvents.publish({
        type: AppEvents.alertWarning.name,
        payload: [
          t(
            'browse-dashboards.restore.partial-failure',
            '{{failedCount}} of {{totalCount}} dashboards failed to restore',
            { failedCount, totalCount }
          ),
        ],
      });
    }

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
          dashboardOrigin: selectedDashboardOrigin,
          onConfirm: onRestore,
          isLoading: isRestoreLoading,
        },
      })
    );
  };

  return (
    <Stack gap={1}>
      <Button onClick={showRestoreModal} variant="secondary">
        <Trans i18nKey="recently-deleted.buttons.restore">Restore</Trans>
      </Button>
    </Stack>
  );
}
