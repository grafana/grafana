import React from 'react';

import { Space } from '@grafana/experimental';
import { ConfirmModal, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { DescendantCount } from 'app/features/browse-dashboards/components/BrowseActions/DescendantCount';
import { DashboardTreeSelection } from 'app/features/browse-dashboards/types';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
  isLoading: boolean;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, isLoading, ...props }: Props) => {
  const onDelete = async () => {
    await onConfirm();
    onDismiss();
  };

  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">
            <Trans i18nKey="browse-dashboards.action.delete-modal-text">
              This action will delete the following content:
            </Trans>
          </Text>
          <DescendantCount selectedItems={selectedItems} />
          <Space v={2} />
        </>
      }
      confirmationText="Delete"
      confirmText={
        isLoading
          ? t('browse-dashboards.action.deleting', 'Deleting...')
          : t('browse-dashboards.action.delete-button', 'Delete')
      }
      onDismiss={onDismiss}
      onConfirm={onDelete}
      title={t('browse-dashboards.action.delete-modal-title', 'Delete')}
      {...props}
    />
  );
};
