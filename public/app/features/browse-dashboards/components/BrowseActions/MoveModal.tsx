import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, isTruthy } from '@grafana/data';
import { Alert, Button, Field, Modal, useStyles2 } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

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

  // TODO abstract all this counting logic out
  const folderCount = Object.values(selectedItems.folder).filter(isTruthy).length;
  const dashboardCount = Object.values(selectedItems.dashboard).filter(isTruthy).length;
  // hardcoded values for now
  // TODO replace with dummy API
  const libraryPanelCount = 1;
  const alertRuleCount = 1;

  const onMove = () => {
    if (moveTarget !== undefined) {
      onConfirm(moveTarget);
    }
    onDismiss();
  };

  return (
    <Modal title="Move" onDismiss={onDismiss} {...props}>
      {folderCount > 0 && <Alert severity="warning" title="Moving this item may change its permissions." />}
      This action will move the following content:
      <p className={styles.breakdown}>
        {buildBreakdownString(folderCount, dashboardCount, libraryPanelCount, alertRuleCount)}
      </p>
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
  }),
});
