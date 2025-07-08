import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Drawer, Stack, Tooltip } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { FolderDTO, useDispatch } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { useDeleteItemsMutation, useMoveItemsMutation } from '../../api/browseDashboardsAPI';
import { useActionSelectionState } from '../../state/hooks';
import { setAllSelection } from '../../state/slice';
import { DashboardTreeSelection } from '../../types';
import { BulkDeleteProvisionedResource } from '../BulkDeleteProvisionedResource';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';

export interface Props {
  folderDTO?: FolderDTO;
}

export function BrowseActions({ folderDTO }: Props) {
  console.log('BrowseActions', folderDTO);
  const dispatch = useDispatch();
  const selectedItems = useActionSelectionState();
  const [deleteItems] = useDeleteItemsMutation();
  const [moveItems] = useMoveItemsMutation();
  const [, stateManager] = useSearchStateManager();
  const isProvisionedInstance = useIsProvisionedInstance();

  const [showBulkDeleteProvisionedResource, setShowBulkDeleteProvisionedResource] = useState(false);

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
    // if all selected items are provisioned
    if (isProvisionedInstance) {
      setShowBulkDeleteProvisionedResource(true);
    } else {
      // if all selected items are non-provisioned
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

    // if partially provisioned, we show a warning modal
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
      {showBulkDeleteProvisionedResource && (
        <Drawer
          title={t('browse-dashboards.action.bulk-delete-provisioned-resources', 'Bulk Delete Provisioned Resources')}
          onClose={() => setShowBulkDeleteProvisionedResource(false)}
          size="md"
        >
          <BulkDeleteProvisionedResource
            selectedItems={selectedItems}
            folderUid={folderDTO?.uid || ''}
            onDismiss={() => setShowBulkDeleteProvisionedResource(false)}
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
