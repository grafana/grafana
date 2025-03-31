import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';
import { Repository, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning';

import { PROVISIONING_URL } from '../constants';

interface Props {
  repository: Repository;
}

export function SyncRepository({ repository }: Props) {
  const [createJob, jobQuery] = useCreateRepositoryJobsMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const name = repository.metadata?.name;

  useEffect(() => {
    const appEvents = getAppEvents();
    if (jobQuery.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Pull started'],
      });
    } else if (jobQuery.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error pulling resources', jobQuery.error],
      });
    }
  }, [jobQuery.error, jobQuery.isError, jobQuery.isSuccess]);

  const onClick = () => {
    if (!name) {
      return;
    }
    createJob({
      name,
      job: {
        spec: {
          action: 'pull',
          pull: {
            incremental: false, // will queue a full resync job
          },
        },
      },
    });
    setIsModalOpen(false);
  };

  const isHealthy = Boolean(repository.status?.health.healthy);

  return (
    <>
      <Button
        icon="cloud-download"
        variant={'secondary'}
        tooltip={isHealthy ? undefined : 'Unable to pull an unhealthy repository'}
        disabled={jobQuery.isLoading || !name || !isHealthy}
        onClick={onClick}
      >
        Pull
      </Button>
      {!repository.spec?.sync.enabled && (
        <ConfirmModal
          isOpen={isModalOpen}
          title={'Pull is not enabled'}
          body={`Edit the configuration`}
          confirmText={'Edit'}
          onConfirm={() => navigate(`${PROVISIONING_URL}/${name}/edit`)}
          onDismiss={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
