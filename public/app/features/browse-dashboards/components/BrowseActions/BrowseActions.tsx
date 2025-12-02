import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack, Text } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ManagerKind } from 'app/features/apiserver/types';
import { BulkDeleteProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkDeleteProvisionedResource';
import { BulkExportProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkExportProvisionedResource';
import { BulkMoveProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkMoveProvisionedResource';
import { useAutoSelectUnmanagedDashboards } from 'app/features/provisioning/hooks/useAutoSelectUnmanagedDashboards';
import { useSelectionProvisioningStatus } from 'app/features/provisioning/hooks/useSelectionProvisioningStatus';
import { useSelectionUnmanagedStatus } from 'app/features/provisioning/hooks/useSelectionUnmanagedStatus';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { ShowModalReactEvent } from 'app/types/events';
import { FolderDTO } from 'app/types/folders';
import { useDispatch } from 'app/types/store';

import {
  useDeleteMultipleFoldersMutationFacade,
  useMoveMultipleFoldersMutationFacade,
} from '../../../../api/clients/folder/v1beta1/hooks';
import { useDeleteDashboardsMutation, useMoveDashboardsMutation } from '../../api/browseDashboardsAPI';
import { useActionSelectionState } from '../../state/hooks';
import { setAllSelection } from '../../state/slice';
import { DashboardTreeSelection } from '../../types';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';
import { SelectedMixResourcesMsgModal } from './SelectedMixResourcesMsgModal';

export interface Props {
  folderDTO?: FolderDTO;
}

export function BrowseActions({ folderDTO }: Props) {
  const [showBulkDeleteProvisionedResource, setShowBulkDeleteProvisionedResource] = useState(false);
  const [showBulkMoveProvisionedResource, setShowBulkMoveProvisionedResource] = useState(false);
  const [showBulkExportProvisionedResource, setShowBulkExportProvisionedResource] = useState(false);

  const dispatch = useDispatch();
  const selectedItems = useActionSelectionState();
  const [deleteDashboards] = useDeleteDashboardsMutation();
  const deleteFolders = useDeleteMultipleFoldersMutationFacade();
  const [moveFolders] = useMoveMultipleFoldersMutationFacade();
  const [moveDashboards] = useMoveDashboardsMutation();
  const [, stateManager] = useSearchStateManager();
  const provisioningEnabled = config.featureToggles.provisioning;
  const location = useLocation();
  const selectAllUnmanagedDashboards = useAutoSelectUnmanagedDashboards();

  const { hasProvisioned, hasNonProvisioned } = useSelectionProvisioningStatus(
    selectedItems,
    folderDTO?.managedBy === ManagerKind.Repo
  );
  const { hasUnmanaged, isLoading: isLoadingUnmanaged } = useSelectionUnmanagedStatus(selectedItems);

  const isSearching = stateManager.hasSearchFilters();

  // Handle autoExport URL parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('autoExport') === 'true' && provisioningEnabled) {
      // Remove the parameter from URL
      searchParams.delete('autoExport');
      const newSearch = searchParams.toString();
      locationService.replace({
        pathname: location.pathname,
        search: newSearch ? `?${newSearch}` : '',
      });

      // Wait for dashboards to load, then auto-select unmanaged dashboards and open export drawer
      const attemptAutoSelect = async () => {
        // Try multiple times with delays to ensure dashboards are loaded
        for (let i = 0; i < 5; i++) {
          await selectAllUnmanagedDashboards();
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        
        // Open the drawer after attempting to select
        setShowBulkExportProvisionedResource(true);
      };

      // Start after a short delay to allow page to render
      setTimeout(() => {
        attemptAutoSelect();
      }, 500);
    }
  }, [location.search, location.pathname, provisioningEnabled, selectAllUnmanagedDashboards]);

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    if (isSearching) {
      // Redo search query
      stateManager.doSearchWithDebounce();
    }
  };

  const onDelete = async () => {
    const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
    const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
    await deleteDashboards({ dashboardUIDs: selectedDashboards });
    await deleteFolders({ folderUIDs: selectedFolders });
    trackAction('delete', selectedItems);
    onActionComplete();
  };

  const onMove = async (destinationUID: string) => {
    const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
    const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);

    await moveFolders({ folderUIDs: selectedFolders, destinationUID });
    await moveDashboards({ dashboardUIDs: selectedDashboards, destinationUID });
    trackAction('move', selectedItems);
    onActionComplete();
  };

  const showMoveModal = () => {
    if (provisioningEnabled && hasProvisioned && hasNonProvisioned) {
      // Mixed selection
      appEvents.publish(
        new ShowModalReactEvent({
          component: SelectedMixResourcesMsgModal,
          props: {},
        })
      );
      return;
    }

    if (provisioningEnabled && hasProvisioned) {
      // Only provisioned items
      setShowBulkMoveProvisionedResource(true);
      return;
    }

    // only non-provisioned items
    appEvents.publish(
      new ShowModalReactEvent({
        component: MoveModal,
        props: {
          selectedItems,
          onConfirm: onMove,
        },
      })
    );
  };

  const showDeleteModal = () => {
    if (hasProvisioned && hasNonProvisioned && provisioningEnabled) {
      // Mixed selection
      appEvents.publish(
        new ShowModalReactEvent({
          component: SelectedMixResourcesMsgModal,
          props: {},
        })
      );
    } else if (hasProvisioned && provisioningEnabled) {
      // Only provisioned items
      setShowBulkDeleteProvisionedResource(true);
    } else {
      // Only non-provisioned items
      appEvents.publish(
        new ShowModalReactEvent({
          component: DeleteModal,
          props: {
            selectedItems,
            onConfirm: onDelete,
          },
        })
      );
    }
  };

  const moveButton = (
    <Button onClick={showMoveModal} variant="secondary">
      <Trans i18nKey="browse-dashboards.action.move-button">Move</Trans>
    </Button>
  );

  // Check if any dashboards are selected (export only supports dashboards, not folders)
  const hasSelectedDashboards =
    Object.keys(selectedItems.dashboard || {}).filter((uid) => selectedItems.dashboard[uid]).length > 0;

  const pushButton = (
    <Button
      onClick={() => setShowBulkExportProvisionedResource(true)}
      variant="secondary"
      disabled={!hasUnmanaged || isLoadingUnmanaged || !hasSelectedDashboards}
    >
      <Trans i18nKey="browse-dashboards.action.export-to-repository-button">Export to Repository</Trans>
    </Button>
  );

  return (
    <>
      <Stack gap={1} data-testid="manage-actions">
        {moveButton}
        {provisioningEnabled && pushButton}

        <Button onClick={showDeleteModal} variant="destructive">
          <Trans i18nKey="browse-dashboards.action.delete-button">Delete</Trans>
        </Button>
      </Stack>
      {/* bulk delete */}
      {showBulkDeleteProvisionedResource && (
        <Drawer
          title={
            // Heading levels should only increase by one (a11y)
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.bulk-delete-provisioned-resources', 'Bulk Delete Provisioned Resources')}
            </Text>
          }
          onClose={() => setShowBulkDeleteProvisionedResource(false)}
          size="md"
        >
          <BulkDeleteProvisionedResource
            selectedItems={selectedItems}
            folderUid={folderDTO?.uid || ''}
            onDismiss={() => {
              setShowBulkDeleteProvisionedResource(false);
            }}
          />
        </Drawer>
      )}

      {/* bulk move */}
      {showBulkMoveProvisionedResource && (
        <Drawer
          title={
            // Heading levels should only increase by one (a11y)
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.bulk-move-provisioned-resources', 'Bulk Move Provisioned Resources')}
            </Text>
          }
          onClose={() => setShowBulkMoveProvisionedResource(false)}
          size="md"
        >
          <BulkMoveProvisionedResource
            selectedItems={selectedItems}
            folderUid={folderDTO?.uid}
            onDismiss={() => {
              setShowBulkMoveProvisionedResource(false);
            }}
          />
        </Drawer>
      )}

      {/* bulk export */}
      {showBulkExportProvisionedResource && (
        <Drawer
          title={
            // Heading levels should only increase by one (a11y)
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.bulk-export-provisioned-resources', 'Bulk Export Resources')}
            </Text>
          }
          onClose={() => setShowBulkExportProvisionedResource(false)}
          size="md"
        >
          <BulkExportProvisionedResource
            selectedItems={selectedItems}
            folderUid={folderDTO?.uid}
            onDismiss={() => {
              setShowBulkExportProvisionedResource(false);
            }}
          />
        </Drawer>
      )}
    </>
  );
}

const actionMap = {
  move: 'grafana_manage_dashboards_item_moved',
  delete: 'grafana_manage_dashboards_item_deleted',
} as const;

function trackAction(action: keyof typeof actionMap, selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>) {
  const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);

  reportInteraction(actionMap[action], {
    item_counts: {
      folder: selectedFolders.length,
      dashboard: selectedDashboards.length,
    },
    source: 'tree_actions',
    restore_enabled: Boolean(config.featureToggles.restoreDashboards),
  });
}
