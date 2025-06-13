import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { ConfirmModal, IconButton } from '@grafana/ui';
import { useDeleteRepositoryMutation } from 'app/api/clients/provisioning/v0alpha1';

interface Props {
  name: string;
  redirectTo?: string;
}

export function DeleteRepositoryButton({ name, redirectTo }: Props) {
  const [deleteRepository, request] = useDeleteRepositoryMutation();
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (request.isSuccess) {
      setShowModal(false);
      if (redirectTo) {
        navigate(redirectTo);
      }
    }
  }, [request.isSuccess, redirectTo, navigate]);

  const onConfirm = useCallback(() => {
    deleteRepository({ name });
  }, [deleteRepository, name]);

  return (
    <>
      <IconButton
        name="trash-alt"
        tooltip={t('provisioning.delete-repository-button.tooltip-delete-this-repository', 'Delete this repository')}
        disabled={request.isLoading}
        onClick={() => {
          setShowModal(true);
        }}
      />
      <ConfirmModal
        isOpen={showModal}
        title={t('provisioning.delete-repository-button.title-delete-repository', 'Delete repository config')}
        body={t(
          'provisioning.delete-repository-button.confirm-delete-repository',
          'Are you sure you want to delete the repository config?'
        )}
        confirmText={t('provisioning.delete-repository-button.button-delete', 'Delete')}
        onConfirm={onConfirm}
        onDismiss={() => setShowModal(false)}
      />
    </>
  );
}
