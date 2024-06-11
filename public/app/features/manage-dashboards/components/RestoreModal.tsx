import React from 'react';

import { ConfirmModal, Text } from '@grafana/ui';

import { Trans, t } from '../../../core/internationalization';
import { DescendantCount } from '../../browse-dashboards/components/BrowseActions/DescendantCount';
import { DashboardTreeSelection } from '../../browse-dashboards/types';

interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
  isLoading: boolean;
}

export const RestoreModal = ({ onConfirm, onDismiss, selectedItems, isLoading, ...props }: Props) => {
  const onRestore = async () => {
    await onConfirm();
    onDismiss();
  };
  return (
    <ConfirmModal
      body={
        <>
          <Text element="p">
            <Trans i18nKey="recentlyDeleted.restoreModal.text">This action will restore the following content:</Trans>
          </Text>
          <DescendantCount selectedItems={selectedItems} />{' '}
          {/*TODO: "3 items: 3 dashboards" doesn't make sense => replace by list of dashboards (list up to 5 dashboards) or number (from 6 dashboards) */}
        </>
      }
      confirmText={
        isLoading
          ? t('recentlyDeleted.restoreModal.confirmText.ongoing', 'Restoring...')
          : t('recentlyDeleted.restoreModal.confirmText.success', 'Restore')
      }
      confirmButtonVariant="primary"
      onDismiss={onDismiss}
      onConfirm={onRestore}
      title={t('recentlyDeleted.restoreModal.title', 'Restore')}
      {...props}
    />
  );
};
