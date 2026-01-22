import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { Connection, useDeleteConnectionMutation } from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { CONNECTIONS_URL } from '../constants';

interface Props {
  name: string;
  connection: Connection;
}

export function DeleteConnectionButton({ name, connection }: Props) {
  const navigate = useNavigate();
  const [deleteConnection, deleteRequest] = useDeleteConnectionMutation();

  const onDelete = useCallback(async () => {
    reportInteraction('grafana_provisioning_connection_deleted', {
      connectionName: name,
      connectionType: connection?.spec?.type ?? 'unknown',
    });

    await deleteConnection({ name });
    navigate(CONNECTIONS_URL);
  }, [deleteConnection, name, connection, navigate]);

  const showDeleteModal = useCallback(() => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('provisioning.connections.delete-title', 'Delete connection'),
        text: t(
          'provisioning.connections.delete-confirm',
          'Are you sure you want to delete this connection? This action cannot be undone.'
        ),
        yesText: t('provisioning.connections.delete', 'Delete'),
        noText: t('provisioning.connections.cancel', 'Cancel'),
        yesButtonVariant: 'destructive',
        onConfirm: onDelete,
      })
    );
  }, [onDelete]);

  return (
    <Button variant="destructive" size="md" disabled={deleteRequest.isLoading} onClick={showDeleteModal}>
      <Trans i18nKey="provisioning.connections.delete">Delete</Trans>
    </Button>
  );
}
