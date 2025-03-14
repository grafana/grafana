import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { ConfirmModal, IconButton } from '@grafana/ui';
import { useDeleteRepositoryMutation } from 'app/api/clients/provisioning';

const appEvents = getAppEvents();

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
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Repository settings queued for deletion'],
      });
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
        tooltip="Delete this repository"
        disabled={request.isLoading}
        onClick={() => {
          setShowModal(true);
        }}
      />
      <ConfirmModal
        isOpen={showModal}
        title={'Delete repository config'}
        body={'Are you sure you want to delete the repository config?'}
        confirmText={'Delete'}
        onConfirm={onConfirm}
        onDismiss={() => setShowModal(false)}
      />
    </>
  );
}
