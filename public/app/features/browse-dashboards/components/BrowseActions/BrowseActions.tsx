import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack, Text } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { BulkDeleteProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkDeleteProvisionedResource';
import { BulkMoveProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkMoveProvisionedResource';
import { useSelectionProvisioningStatus } from 'app/features/provisioning/hooks/useSelectionProvisioningStatus';
import { isItemManagedByRepository } from 'app/features/provisioning/utils/managedResource';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { ShowModalReactEvent } from 'app/types/events';
import { type FolderDTO } from 'app/types/folders';
import { useDispatch } from 'app/types/store';

import {
  useDeleteMultipleFoldersMutationFacade,
  useMoveMultipleFoldersMutationFacade,
} from '../../../../api/clients/folder/v1beta1/hooks';
import { useDeleteDashboardsMutation, useMoveDashboardsMutation } from '../../api/browseDashboardsAPI';
import { useActionSelectionState, useHasSelection } from '../../state/hooks';
import { setAllSelection } from '../../state/slice';
import { type DashboardTreeSelection } from '../../types';
import { getSelectedUIDs } from '../../utils/dashboards';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';
import { SelectedMixResourcesMsgModal } from './SelectedMixResourcesMsgModal';

export interface Props {
  folderDTO?: FolderDTO;
}

type BulkSelection = Omit<DashboardTreeSelection, 'panel' | '$all'>;

/**
 * The open provisioned drawer and the context it was opened in. A snapshot, not the live values: a
 * repository pull or the job itself clears the selection, and the page can navigate to another
 * folder (browser back), while the drawer is still open.
 */
interface BulkAction {
  kind: 'delete' | 'move';
  selectedItems: BulkSelection;
  folderUid: string | undefined;
}

export function BrowseActions({ folderDTO }: Props) {
  const [bulkAction, setBulkAction] = useState<BulkAction>();

  const dispatch = useDispatch();
  const hasSelection = useHasSelection();
  const selectedItems = useActionSelectionState();
  const [deleteDashboards] = useDeleteDashboardsMutation();
  const deleteFolders = useDeleteMultipleFoldersMutationFacade();
  const [moveFolders] = useMoveMultipleFoldersMutationFacade();
  const [moveDashboards] = useMoveDashboardsMutation();
  const [, stateManager] = useSearchStateManager();
  const provisioningEnabled = config.provisioningEnabled;

  const { hasProvisioned, hasNonProvisioned } = useSelectionProvisioningStatus(
    selectedItems,
    isItemManagedByRepository(folderDTO)
  );

  const isSearching = stateManager.hasSearchFilters();

  const clearSelection = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));
  };

  const closeBulkAction = () => setBulkAction(undefined);

  const onActionComplete = () => {
    clearSelection();

    if (isSearching) {
      // Redo search query
      stateManager.doSearchWithDebounce();
    }
  };

  const onDelete = async () => {
    const selectedDashboards = getSelectedUIDs(selectedItems, 'dashboard');
    const selectedFolders = getSelectedUIDs(selectedItems, 'folder');
    await deleteDashboards({ dashboardUIDs: selectedDashboards });
    await deleteFolders({ folderUIDs: selectedFolders });
    trackAction('delete', selectedItems);
    onActionComplete();
  };

  const onMove = async (destinationUID: string) => {
    const selectedDashboards = getSelectedUIDs(selectedItems, 'dashboard');
    const selectedFolders = getSelectedUIDs(selectedItems, 'folder');

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
      setBulkAction({ kind: 'move', selectedItems, folderUid: folderDTO?.uid });
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
      setBulkAction({ kind: 'delete', selectedItems, folderUid: folderDTO?.uid });
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
    <Button
      onClick={showMoveModal}
      variant="secondary"
      data-testid={selectors.pages.BrowseDashboards.actions.moveButton}
    >
      <Trans i18nKey="browse-dashboards.action.move-button">Move</Trans>
    </Button>
  );

  return (
    <>
      {hasSelection && (
        <Stack gap={1} data-testid="manage-actions">
          {moveButton}

          <Button
            onClick={showDeleteModal}
            variant="destructive"
            data-testid={selectors.pages.BrowseDashboards.actions.deleteButton}
          >
            <Trans i18nKey="browse-dashboards.action.delete-button">Delete</Trans>
          </Button>
        </Stack>
      )}
      {/* The drawer outlives the selection: the job spends it, and the drawer stays open to show
          the job's status. The sync watch refreshes the list once the pull lands. */}
      {bulkAction?.kind === 'delete' && (
        <Drawer
          title={
            // Heading levels should only increase by one (a11y)
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.bulk-delete-provisioned-resources', 'Bulk Delete Provisioned Resources')}
            </Text>
          }
          onClose={closeBulkAction}
          size="md"
        >
          <BulkDeleteProvisionedResource
            selectedItems={bulkAction.selectedItems}
            folderUid={bulkAction.folderUid || ''}
            onDismiss={closeBulkAction}
            onJobCreated={clearSelection}
          />
        </Drawer>
      )}

      {bulkAction?.kind === 'move' && (
        <Drawer
          title={
            // Heading levels should only increase by one (a11y)
            <Text variant="h3" element="h2">
              {t('browse-dashboards.action.bulk-move-provisioned-resources', 'Bulk Move Provisioned Resources')}
            </Text>
          }
          onClose={closeBulkAction}
          size="md"
        >
          <BulkMoveProvisionedResource
            selectedItems={bulkAction.selectedItems}
            folderUid={bulkAction.folderUid}
            onDismiss={closeBulkAction}
            onJobCreated={clearSelection}
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

function trackAction(action: keyof typeof actionMap, selectedItems: BulkSelection) {
  const selectedDashboards = getSelectedUIDs(selectedItems, 'dashboard');
  const selectedFolders = getSelectedUIDs(selectedItems, 'folder');

  reportInteraction(actionMap[action], {
    item_counts: {
      folder: selectedFolders.length,
      dashboard: selectedDashboards.length,
    },
    source: 'tree_actions',
  });
}
