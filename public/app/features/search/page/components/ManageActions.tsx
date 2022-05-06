import React, { useState } from 'react';

import { Button, Checkbox, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { getStyles } from './ActionRow';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MoveToFolderModal } from './MoveToFolderModal';

type Props = {
  items: Map<string, Set<string>>;
};

export function ManageActions({ items }: Props) {
  const styles = useStyles2(getStyles);

  // TODO: check user permissions for move and delete
  const canMove = true;
  const canDelete = true;
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const onMove = () => {
    setIsMoveModalOpen(true);
  };

  const onDelete = () => {
    alert('TODO, delete....');
  };

  const onToggleAll = () => {
    alert('TODO, toggle all....');
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

      <MoveToFolderModal
        onMoveItems={items}
        results={items}
        isOpen={isMoveModalOpen}
        onDismiss={() => setIsMoveModalOpen(false)}
      />
    </div>
  );
}
