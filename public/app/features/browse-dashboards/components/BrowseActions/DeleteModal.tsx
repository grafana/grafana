import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, isTruthy } from '@grafana/data';
import { ConfirmModal, useStyles2 } from '@grafana/ui';

import { DashboardTreeSelection } from '../../types';

import { buildBreakdownString } from './utils';

export interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const styles = useStyles2(getStyles);

  // TODO abstract all this counting logic out
  const folderCount = Object.values(selectedItems.folder).filter(isTruthy).length;
  const dashboardCount = Object.values(selectedItems.dashboard).filter(isTruthy).length;
  // hardcoded values for now
  // TODO replace with dummy API
  const libraryPanelCount = 1;
  const alertRuleCount = 1;

  const onDelete = () => {
    onConfirm();
    onDismiss();
  };

  return (
    <ConfirmModal
      body={
        <div className={styles.modalBody}>
          This action will delete the following content:
          <p className={styles.breakdown}>
            {buildBreakdownString(folderCount, dashboardCount, libraryPanelCount, alertRuleCount)}
          </p>
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
  breakdown: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
  }),
  modalBody: css({
    ...theme.typography.body,
  }),
});
