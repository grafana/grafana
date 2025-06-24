import { useMemo } from 'react';

import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { useDispatch } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { useListDeletedDashboardsQuery, useRestoreDashboardMutation } from '../api/browseDashboardsAPI';
import { useRecentlyDeletedStateManager } from '../api/useRecentlyDeletedStateManager';
import { clearFolders, setAllSelection, useActionSelectionState } from '../state';

import { RestoreModal } from './RestoreModal';

export function RecentlyDeletedActions() {
  const dispatch = useDispatch();
  const selectedItemsState = useActionSelectionState();
  const [searchState, stateManager] = useRecentlyDeletedStateManager();
  const deletedDashboards = useListDeletedDashboardsQuery();
  const [restoreDashboard, { isLoading: isRestoreLoading }] = useRestoreDashboardMutation();

  const selectedDashboards = useMemo(() => {
    return Object.entries(selectedItemsState.dashboard)
      .filter(([_, selected]) => selected)
      .map(([uid]) => uid);
  }, [selectedItemsState.dashboard]);

  const selectedDashboardOrigin: string[] = [];
  if (searchState.result) {
    for (const selectedDashboard of selectedDashboards) {
      const index = searchState.result.view.fields.uid.values.findIndex((e) => e === selectedDashboard);

      // SQLSearcher changes the location from empty string to 'general' for items with no parent,
      // but the restore API doesn't work with 'general' folder UID, so we need to convert it back
      // to an empty string
      const location = searchState.result.view.fields.location.values[index];
      const fixedLocation = location === GENERAL_FOLDER_UID ? '' : location;
      selectedDashboardOrigin.push(fixedLocation);
    }
  }

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    stateManager.doSearchWithDebounce();
  };

  const onRestore = async (restoreTarget: string) => {
    const resultsView = stateManager.state.result?.view.toArray();
    if (!resultsView) {
      return;
    }

    const promises = selectedDashboards.map((uid) => {
      const dashboard = deletedDashboards.data?.items.find((d) => d.metadata.name === uid);
      if (!dashboard) {
        return Promise.resolve();
      }
      // Clone the dashboard to be able to edit the immutable data from the store
      const copy = structuredClone(dashboard);
      copy.metadata = {
        ...copy.metadata,
        annotations: { ...copy.metadata?.annotations, [AnnoKeyFolder]: restoreTarget },
      };

      return restoreDashboard({ dashboard: copy });
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
