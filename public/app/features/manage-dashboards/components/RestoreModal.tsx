import React from 'react';

import { ConfirmModal, Text } from '@grafana/ui';

import { Trans, t } from '../../../core/internationalization';
import { DashboardTreeSelection } from '../../browse-dashboards/types';

interface Props {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
  selectedItems: DashboardTreeSelection;
  isLoading: boolean;
}

export const RestoreModal = ({ onConfirm, onDismiss, selectedItems, isLoading, ...props }: Props) => {
  const numberOfDashboards = selectedItems ? Object.keys(selectedItems.dashboard).length : 0;
  const onRestore = async () => {
    await onConfirm();
    onDismiss();
  };
  return (
    <ConfirmModal
      body={
        <Text element="p">
          <Trans i18nKey="recentlyDeleted.restoreModal.text" count={numberOfDashboards}>
            This action will restore {{ numberOfDashboards }} dashboards.
          </Trans>
        </Text>
        // TODO: replace by list of dashboards (list up to 5 dashboards) or number (from 6 dashboards)?
      }
      confirmText={
        isLoading
          ? t('recentlyDeleted.restoreModal.confirmText.ongoing', 'Restoring...')
          : t('recentlyDeleted.restoreModal.confirmText.success', 'Restore')
      }
      confirmButtonVariant="primary"
      onDismiss={onDismiss}
      onConfirm={onRestore}
      title={t('recentlyDeleted.restoreModal.title', 'Restore Dashboards')}
      {...props}
    />
  );
};
