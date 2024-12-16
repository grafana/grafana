import { useCallback, useEffect, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';

import { useDeleteRepositoryMutation } from './api';

const appEvents = getAppEvents();
export function DeleteRepositoryButton({ name }: { name: string }) {
  const [deleteRepository, request] = useDeleteRepositoryMutation();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (request.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Repository settings deleted'],
      });
    }
  }, [request.isSuccess]);

  const onConfirm = useCallback(() => {
    deleteRepository({ name, body: {} });
  }, [deleteRepository, name]);

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
