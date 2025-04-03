import { useMemo } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { Button, Stack, Tooltip } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t, Trans } from 'app/core/internationalization';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';

import { useDeleteItemsMutation, useMoveItemsMutation } from '../../api/browseDashboardsAPI';
import { setAllSelection, useActionSelectionState } from '../../state';
import { DashboardTreeSelection } from '../../types';

import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';

export interface Props {}

export function BrowseActions() {
  const dispatch = useDispatch();
  const selectedItems = useActionSelectionState();
  const [deleteItems] = useDeleteItemsMutation();
  const [moveItems] = useMoveItemsMutation();
  const [, stateManager] = useSearchStateManager();

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
    appEvents.publish(
      new ShowModalReactEvent({
        component: DeleteModal,
        props: {
          selectedItems,
          onConfirm: onDelete,
        },
      })
    );
  };

  const moveButton = (
    <Button onClick={showMoveModal} variant="secondary" disabled={moveIsInvalid}>
      <Trans i18nKey="browse-dashboards.action.move-button">Move</Trans>
    </Button>
  );

  return (
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
    restore_enabled: false,
  });
}
