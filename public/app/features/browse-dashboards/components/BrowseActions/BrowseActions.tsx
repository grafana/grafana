import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack, Tooltip } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ManagerKind } from 'app/features/apiserver/types';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { ShowModalReactEvent } from 'app/types/events';
import { FolderDTO } from 'app/types/folders';
import { useDispatch } from 'app/types/store';

import { useDeleteItemsMutation, useMoveItemsMutation } from '../../api/browseDashboardsAPI';
import { useActionSelectionState } from '../../state/hooks';
import { setAllSelection } from '../../state/slice';
import { DashboardTreeSelection } from '../../types';
import { BulkDeleteProvisionedResource } from '../BulkActions/BulkDeleteProvisionedResource';
import { BulkMoveProvisionedResource } from '../BulkActions/BulkMoveProvisionedResource';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';
import { SelectedMixResourcesMsgModal } from './SelectedMixResourcesMsgModal';
import { useSelectionProvisioningStatus } from './useSelectionProvisioningStatus';

export interface Props {
  folderDTO?: FolderDTO;
}

export function BrowseActions({ folderDTO }: Props) {
  const [showBulkDeleteProvisionedResource, setShowBulkDeleteProvisionedResource] = useState(false);
  const [showBulkMoveProvisionedResource, setShowBulkMoveProvisionedResource] = useState(false);

  const dispatch = useDispatch();
  const selectedItems = useActionSelectionState();
  const [deleteItems] = useDeleteItemsMutation();
  const [moveItems] = useMoveItemsMutation();
  const [, stateManager] = useSearchStateManager();
  const provisioningEnabled = config.featureToggles.provisioning;

  const { hasProvisioned, hasNonProvisioned } = useSelectionProvisioningStatus(
    selectedItems,
    folderDTO?.managedBy === ManagerKind.Repo
  );

  // Folders can only be moved if nested folders is enabled
  const moveIsInvalid = useMemo(
    () => !config.featureToggles.nestedFolders && Object.values(selectedItems.folder).some((v) => v),
    [selectedItems]
  );

  const isSearching = stateManager.hasSearchFilters();

  const onActionComplete = () => {
    dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));

    if (isSearching) {
      // Redo search query
      stateManager.doSearchWithDebounce();
    }
  };

  const onDelete = async () => {
    await deleteItems({ selectedItems });
    trackAction('delete', selectedItems);
    onActionComplete();
  };

  const onMove = async (destinationUID: string) => {
    await moveItems({ selectedItems, destinationUID });
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
    <Button onClick={showMoveModal} variant="secondary" disabled={moveIsInvalid}>
      <Trans i18nKey="browse-dashboards.action.move-button">Move</Trans>
    </Button>
  );

  return (
    <>
      <Stack gap={1} data-testid="manage-actions">
        {moveIsInvalid ? (
          <Tooltip content={t('browse-dashboards.action.cannot-move-folders', 'Folders cannot be moved')}>
            {moveButton}
          </Tooltip>
        ) : (
          moveButton
        )}

        <Button onClick={showDeleteModal} variant="destructive">
          <Trans i18nKey="browse-dashboards.action.delete-button">Delete</Trans>
        </Button>
      </Stack>
      {/* bulk delete */}
      {showBulkDeleteProvisionedResource && (
        <Drawer
          title={t('browse-dashboards.action.bulk-delete-provisioned-resources', 'Bulk Delete Provisioned Resources')}
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
          title={t('browse-dashboards.action.bulk-move-provisioned-resources', 'Bulk Move Provisioned Resources')}
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
