import React, { useState } from 'react';

import { Button, Checkbox, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { FolderDTO, FolderInfo } from 'app/types';

import { GENERAL_FOLDER_UID } from '../../constants';

import { getStyles } from './ActionRow';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MoveToFolderModal } from './MoveToFolderModal';

type Props = {
  items: Map<string, Set<string>>;
  folder?: FolderDTO; // when we are loading in folder page
};

export function ManageActions({ items, folder }: Props) {
  const styles = useStyles2(getStyles);

  const canSave = folder?.canSave;
  const hasEditPermissionInFolders = folder ? canSave : contextSrv.hasEditPermissionInFolders;

  const canMove = hasEditPermissionInFolders;

  // TODO: check user permissions for delete, should not be able to delete if includes general folder and user don't have permissions
  // There is not GENERAL_FOLDER_UID configured yet, we need to make sure to add it to the data.
  const selectedFolders = Array.from(items.get('folders') ?? []);
  console.log({ selectedFolders });
  const includesGeneralFolder = selectedFolders.find((result) => result === GENERAL_FOLDER_UID);

  const canDelete = hasEditPermissionInFolders && !includesGeneralFolder;
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const onMove = () => {
    setIsMoveModalOpen(true);
  };

  const onDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const onToggleAll = () => {
    alert('TODO, toggle all....');
  };

  //Todo: update item lists that were moved
  const onMoveItems = (selectedDashboards: string[], folder: FolderInfo | null) => {
    console.log({ selectedDashboards });
    console.log({ folder });
    console.log('items were moved in the backend');
  };

  //Todo: update item lists that were deleted
  const onDeleteItems = (folders: string[], dashboards: string[]) => {
    console.log({ folders });
    console.log({ dashboards });
    console.log('items were moved in the backend');
  };

  return (
    <div className={styles.actionRow}>
      <div className={styles.rowContainer}>
        <HorizontalGroup spacing="md" width="auto">
          <Checkbox value={false} onClick={onToggleAll} />
          <Button disabled={!canMove} onClick={onMove} icon="exchange-alt" variant="secondary">
            Move
          </Button>
          <Button disabled={!canDelete} onClick={onDelete} icon="trash-alt" variant="destructive">
            Delete
          </Button>

          {[...items.keys()].map((k) => {
            const vals = items.get(k);
            return (
              <div key={k}>
                {k} ({vals?.size})
              </div>
            );
          })}
        </HorizontalGroup>
      </div>

      <ConfirmDeleteModal
        onDeleteItems={onDeleteItems}
        results={items}
        isOpen={isDeleteModalOpen}
        onDismiss={() => setIsDeleteModalOpen(false)}
      />
      <MoveToFolderModal
        onMoveItems={onMoveItems}
        results={items}
        isOpen={isMoveModalOpen}
        onDismiss={() => setIsMoveModalOpen(false)}
      />
    </div>
  );
}
