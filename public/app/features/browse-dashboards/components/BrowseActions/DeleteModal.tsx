import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ConfirmModal, useStyles2 } from '@grafana/ui';

import { DashboardTreeSelection } from '../../types';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const styles = useStyles2(getStyles);

  const onDelete = () => {
    onConfirm();
    onDismiss();
  };

  return (
    <ConfirmModal
      body={
        <div className={styles.modalBody}>
          This action will delete the following content:
          <DescendantCount selectedItems={selectedItems} />
        </div>
      }
      confirmationText="Delete"
      confirmText="Delete"
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title="Delete Compute Resources"
      {...props}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modalBody: css({
    ...theme.typography.body,
  }),
});
