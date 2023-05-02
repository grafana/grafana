import React from 'react';

import { Space, Stack } from '@grafana/experimental';
import { Alert, ConfirmModal, Spinner } from '@grafana/ui';
import { P } from '@grafana/ui/src/unstable';

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
  const { data, isFetching, isLoading, error } = useGetAffectedItemsQuery(selectedItems);

  const onDelete = () => {
    onConfirm();
    onDismiss();
  };

  return (
    <ConfirmModal
      body={
        <>
          <Stack direction="column" gap={0.5}>
            <P>This action will delete the following content:</P>
            <P color="secondary">
              <>
                {data && buildBreakdownString(data.folder, data.dashboard, data.libraryPanel, data.alertRule)}
                {(isFetching || isLoading) && <Spinner size={12} />}
                {error && <Alert severity="error" title="Unable to retrieve descendant information" />}
              </>
            </P>
          </Stack>
          <Space v={2} />
        </>
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
