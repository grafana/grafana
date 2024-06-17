import React from 'react';

import { ConfirmModal, Text } from '@grafana/ui';

import { Trans, t } from '../../../core/internationalization';

import { Props as ModalProps } from './RestoreModal';

export const PermanentlyDeleteModal = ({ onConfirm, onDismiss, selectedItems, isLoading, ...props }: ModalProps) => {
  const numberOfDashboards = 100;
  return (
    <ConfirmModal
      body={
        <Text element="p">
          <Trans i18nKey="recently-deleted.permanently-delete-modal.text" count={numberOfDashboards}>
            This action will restore {{ numberOfDashboards }} dashboards.
          </Trans>
        </Text>
      }
      title={t('recently-deleted.permanently-delete-modal.title', 'Permanently Delete Dashboards')}
      confirmText={
        isLoading
          ? t('recently-deleted.permanently-delete-modal.delete-loading', 'Restoring...')
          : t('recently-deleted.permanently-delete-modal.delete-button', 'Restore')
      }
      confirmButtonVariant="destructive"
      onConfirm={onConfirm} //TODO: change this
      onDismiss={onDismiss}
    />
  );
};
