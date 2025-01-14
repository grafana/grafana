import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { AppEvents } from '@grafana/data';
import { config, getAppEvents, getBackendSrv } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';

import { Loader } from '../plugins/admin/components/Loader';

import { Repository, useCreateRepositorySyncMutation, useListRepositoryQuery } from './api';

interface Props {
  repository: Repository;
}

export function SyncRepository({ repository }: Props) {
  const query = useListRepositoryQuery();
  const [syncResource, syncQuery] = useCreateRepositorySyncMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const name = repository.metadata?.name;
  const folder = repository.spec?.folder;

  // TODO generate endpoints for this
  const { value } = useAsync(async () => {
    if (!folder) {
      return;
    }
    return getBackendSrv().get(`/apis/folder.grafana.app/v0alpha1/namespaces/${config.namespace}/folders/${folder}`);
  });

  useEffect(() => {
    // TODO... not true anymore --
    // clicking sync just means we queued the job; can watch it until finished
    const appEvents = getAppEvents();
    if (syncQuery.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Resources imported'],
      });
      // TODO the URL will be different based on the type of resource imported
      navigate(`/dashboards${folder ? `/f/${folder}` : ''}`);
    } else if (syncQuery.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error importing resources', syncQuery.error],
      });
    }
  }, [folder, syncQuery.error, syncQuery.isError, syncQuery.isSuccess, navigate]);

  const onClick = () => {
    if (!name) {
      return;
    }

    syncResource({ name });
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
      <ConfirmModal
        isOpen={isModalOpen}
        title={'Synchronize resources from repository'}
        body={`This will pull all resources from the repository into your instance into the "${value?.spec?.title}" folder. Existing dashboards with the same UID will be overwritten. Proceed?`}
        confirmText={syncQuery.isLoading ? 'Importing...' : 'Import'}
        onConfirm={onClick}
        onDismiss={() => setIsModalOpen(false)}
      />
    </>
  );
}
