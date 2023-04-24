import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Field, Modal, useStyles2 } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

export interface Props {
  onDismiss: () => void;
}

export const MoveModal = ({ onDismiss, ...props }: Props) => {
  const [moveTarget, setMoveTarget] = useState<string>();
  const styles = useStyles2(getStyles);

  const onMove = () => {
    console.log(`onMove clicked with target ${moveTarget}!`);
    onDismiss();
  };

  return (
    <Modal title="Move" onDismiss={onDismiss} {...props}>
      <Alert severity="warning" title="Moving this item may change its permissions." />
      This action will move the following content:
      <p className={styles.breakdown}>6 items: 1 subfolder, 1 library panel, 2 dashboards, 2 alert rules</p>
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
