import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Button, ConfirmModal } from '@grafana/ui';

import { useDeleteRepositoryMutation } from './api';
import { PROVISIONING_URL } from './constants';

export function DeleteRepositoryButton({ name }: { name: string }) {
  const [deleteRepository, request] = useDeleteRepositoryMutation();
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const onConfirm = useCallback(() => {
    deleteRepository({ name });

    if (request.isSuccess) {
      navigate(PROVISIONING_URL);
    }
  }, [deleteRepository, name, request.isSuccess, navigate]);

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => {
          setShowModal(true);
        }}
      >
        Delete
      </Button>
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
