import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';
import { Connection, useDeleteConnectionMutation } from 'app/api/clients/provisioning/v0alpha1';

import { CONNECTIONS_URL } from '../constants';

interface Props {
  name: string;
  connection: Connection;
}

export function DeleteConnectionButton({ name, connection }: Props) {
  const navigate = useNavigate();
  const [deleteConnection, deleteRequest] = useDeleteConnectionMutation();
  const [showModal, setShowModal] = useState(false);

  const onConfirm = useCallback(async () => {
    reportInteraction('grafana_provisioning_connection_deleted', {
      connectionName: name,
      connectionType: connection?.spec?.type ?? 'unknown',
    });

    await deleteConnection({ name });
    setShowModal(false);

    navigate(CONNECTIONS_URL);
  }, [deleteConnection, name, connection, navigate]);

  return (
    <>
      <Button variant="destructive" size="md" disabled={deleteRequest.isLoading} onClick={() => setShowModal(true)}>
        <Trans i18nKey="provisioning.connections.delete">Delete</Trans>
      </Button>
      <ConfirmModal
        isOpen={showModal}
        title={t('provisioning.connections.delete-title', 'Delete connection')}
        body={t(
          'provisioning.connections.delete-confirm',
          'Are you sure you want to delete this connection? This action cannot be undone.'
        )}
        confirmText={t('provisioning.connections.delete', 'Delete')}
        onConfirm={onConfirm}
        onDismiss={() => setShowModal(false)}
      />
    </>
  );
}
