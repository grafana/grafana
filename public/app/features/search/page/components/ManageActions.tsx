import React, { useState } from 'react';

import { Button, HorizontalGroup, IconButton, IconName, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { FolderDTO } from 'app/types';

import { GENERAL_FOLDER_UID } from '../../constants';
import { OnMoveOrDeleleSelectedItems } from '../../types';

import { getStyles } from './ActionRow';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MoveToFolderModal } from './MoveToFolderModal';

type Props = {
  items: Map<string, Set<string>>;
  folder?: FolderDTO; // when we are loading in folder page
  onChange: OnMoveOrDeleleSelectedItems;
  clearSelection: () => void;
};

export function ManageActions({ items, folder, onChange, clearSelection }: Props) {
  const styles = useStyles2(getStyles);

  const canSave = folder?.canSave;
  const hasEditPermissionInFolders = folder ? canSave : contextSrv.hasEditPermissionInFolders;

  const canMove = hasEditPermissionInFolders;

  // TODO: check user permissions for delete, should not be able to delete if includes general folder and user don't have permissions
  // There is not GENERAL_FOLDER_UID configured yet, we need to make sure to add it to the data.
  const selectedFolders = Array.from(items.get('folder') ?? []);
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

  return (
    <div className={styles.actionRow}>
      <div className={styles.rowContainer}>
        <HorizontalGroup spacing="md" width="auto">
          <IconButton name={'check-square' as IconName} onClick={clearSelection} title="Uncheck everything" />
          <Button disabled={!canMove} onClick={onMove} icon="exchange-alt" variant="secondary">
            Move
          </Button>
          <Button disabled={!canDelete} onClick={onDelete} icon="trash-alt" variant="destructive">
            Delete
          </Button>
        </HorizontalGroup>
      </div>

      <ConfirmDeleteModal
        onDeleteItems={onChange}
        results={items}
        isOpen={isDeleteModalOpen}
        onDismiss={() => setIsDeleteModalOpen(false)}
      />
      <MoveToFolderModal
        onMoveItems={onChange}
        results={items}
        isOpen={isMoveModalOpen}
        onDismiss={() => setIsMoveModalOpen(false)}
      />
    </div>
  );
}
