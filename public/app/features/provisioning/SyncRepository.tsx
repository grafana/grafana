import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';

import { Loader } from '../plugins/admin/components/Loader';

import { Repository, useCreateRepositorySyncMutation, useListRepositoryQuery } from './api';
import { PROVISIONING_URL } from './constants';

interface Props {
  repository: Repository;
}

export function SyncRepository({ repository }: Props) {
  const query = useListRepositoryQuery({});
  const [syncResource, syncQuery] = useCreateRepositorySyncMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const name = repository.metadata?.name;

  useEffect(() => {
    const appEvents = getAppEvents();
    if (syncQuery.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Sync started'],
      });
    } else if (syncQuery.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error importing resources', syncQuery.error],
      });
    }
  }, [syncQuery.error, syncQuery.isError, syncQuery.isSuccess, navigate]);

  const onClick = () => {
    if (!name) {
      return;
    }
    const elapsed = Date.now() - (repository.status?.sync.started ?? 0);
    const complete = elapsed < 10000; // If clicked recently
    console.log('Time since last sync: ', { elapsed, complete });
    syncResource({ name, body: { complete } });
    setIsModalOpen(false);
  };

  if (query.isLoading) {
    return <Loader />;
  }

  const isHealthy = Boolean(repository.status?.health.healthy);

  return (
    <>
      <Button
        variant={'secondary'}
        tooltip={isHealthy ? undefined : 'Unable to sync an unhealthy repository'}
        disabled={syncQuery.isLoading || !name || !isHealthy}
        onClick={() => setIsModalOpen(true)}
      >
        Sync
      </Button>
      {repository.spec?.sync.enabled ? (
        <ConfirmModal
          isOpen={isModalOpen}
          title={'Synchronize resources from repository'}
          body={`This will trigger a job that will import everything from the repository into grafana. Proceed?`}
          confirmText={syncQuery.isLoading ? 'Importing...' : 'Import'}
          onConfirm={onClick}
          onDismiss={() => setIsModalOpen(false)}
        />
      ) : (
        <ConfirmModal
          isOpen={isModalOpen}
          title={'Sync is not enabled'}
          body={`Edit the configuration`}
          confirmText={'Edit'}
          onConfirm={() => navigate(`${PROVISIONING_URL}/${name}/edit`)}
          onDismiss={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
