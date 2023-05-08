import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Field, Modal, Spinner, useStyles2 } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
import { DashboardTreeSelection } from '../../types';

import { buildBreakdownString } from './utils';

export interface Props {
  isOpen: boolean;
  onConfirm: (targetFolderUid: string) => void;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const MoveModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const [moveTarget, setMoveTarget] = useState<string>();
  const styles = useStyles2(getStyles);
  const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
  const { data, isFetching, isLoading, error } = useGetAffectedItemsQuery(selectedItems);

  const onMove = () => {
    if (moveTarget !== undefined) {
      onConfirm(moveTarget);
    }
    onDismiss();
  };

  return (
    <Modal title="Move" onDismiss={onDismiss} {...props}>
      {selectedFolders.length > 0 && <Alert severity="warning" title="Moving this item may change its permissions." />}
      This action will move the following content:
      <div className={styles.breakdown}>
        <>
          {data && buildBreakdownString(data.folder, data.dashboard, data.libraryPanel, data.alertRule)}
          {(isFetching || isLoading) && <Spinner size={12} />}
          {error && <Alert severity="error" title="Unable to retrieve descendant information" />}
        </>
      </div>
      <Field label="Folder name">
        <FolderPicker allowEmpty onChange={({ uid }) => setMoveTarget(uid)} />
      </Field>
      <Modal.ButtonRow>
        <Button onClick={onDismiss} variant="secondary">
          Cancel
        </Button>
        <Button disabled={moveTarget === undefined} onClick={onMove} variant="primary">
          Move
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  breakdown: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(2),
  }),
});
