import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, ConfirmModal, Spinner, useStyles2 } from '@grafana/ui';

import { useGetAffectedItemsQuery } from '../../api/browseDashboardsAPI';
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
  const { data, isFetching, isLoading, error } = useGetAffectedItemsQuery(selectedItems);

  const onDelete = () => {
    onConfirm();
    onDismiss();
  };

  return (
    <ConfirmModal
      body={
        <div className={styles.modalBody}>
          This action will delete the following content:
          <div className={styles.breakdown}>
            <>
              {data && buildBreakdownString(data.folder, data.dashboard, data.libraryPanel, data.alertRule)}
              {(isFetching || isLoading) && <Spinner size={12} />}
              {error && <Alert severity="error" title="Unable to retrieve descendant information" />}
            </>
          </div>
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
    marginBottom: theme.spacing(2),
  }),
  modalBody: css({
    ...theme.typography.body,
  }),
});
