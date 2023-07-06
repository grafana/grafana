import React, { useState } from 'react';

import { Space } from '@grafana/experimental';
import { ConfirmModal } from '@grafana/ui';
import { P } from '@grafana/ui/src/unstable';
import { Trans, t } from 'app/core/internationalization';

import { DashboardTreeSelection } from '../../types';

import { DescendantCount } from './DescendantCount';

export interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
}

export const DeleteModal = ({ onConfirm, onDismiss, selectedItems, ...props }: Props) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const onDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      setIsDeleting(false);
      onDismiss();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmModal
      body={
        <>
          <P>
            <Trans i18nKey="browse-dashboards.action.delete-modal-text">
              This action will delete the following content:
            </Trans>
          </P>
          <DescendantCount selectedItems={selectedItems} />
          <Space v={2} />
        </>
      }
      confirmationText="Delete"
      confirmText={
        isDeleting
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
