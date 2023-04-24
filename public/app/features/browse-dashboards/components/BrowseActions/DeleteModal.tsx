import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ConfirmModal, useStyles2 } from '@grafana/ui';

export interface Props {
  onDismiss: () => void;
}

export const DeleteModal = ({ onDismiss, ...props }: Props) => {
  const styles = useStyles2(getStyles);

  const onConfirm = () => {
    console.log('onConfirm clicked!');
    onDismiss();
  };

  return (
    <ConfirmModal
      body={
        <div className={styles.modalBody}>
          This action will delete the following content:
          <p className={styles.breakdown}>6 items: 1 subfolder, 1 library panel, 2 dashboards, 2 alert rules</p>
        </div>
      }
      confirmationText="Delete"
      confirmText="Delete"
      isOpen
      onDismiss={onDismiss}
      onConfirm={onConfirm}
      title="Delete Compute Resources"
      {...props}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  breakdown: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
  }),
  modalBody: css({
    ...theme.typography.body,
  }),
});
