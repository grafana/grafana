import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';
import { Repository, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning';
import { Trans, t } from 'app/core/internationalization';

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
        payload: [t('provisioning.sync-repository.success-pull-started', 'Pull started')],
      });
    } else if (jobQuery.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [t('provisioning.sync-repository.error-pulling-resources', 'Error pulling resources'), jobQuery.error],
      });
    }
  }, [jobQuery.error, jobQuery.isError, jobQuery.isSuccess]);

  const onClick = () => {
    if (!name) {
      return;
    }
    createJob({
      name,
      jobSpec: {
        pull: {
          incremental: false, // will queue a full resync job
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
        tooltip={
          isHealthy
            ? undefined
            : t('provisioning.sync-repository.tooltip-unhealthy-repository', 'Unable to pull an unhealthy repository')
        }
        disabled={jobQuery.isLoading || !name || !isHealthy}
        onClick={onClick}
      >
        <Trans i18nKey="provisioning.sync-repository.pull">Pull</Trans>
      </Button>
      {!repository.spec?.sync.enabled && (
        <ConfirmModal
          isOpen={isModalOpen}
          title={t('provisioning.sync-repository.title-pull-not-enabled', 'Pull is not enabled')}
          body={t('provisioning.sync-repository.body-edit-configuration', 'Edit the configuration')}
          confirmText={t('provisioning.sync-repository.button-edit', 'Edit')}
          onConfirm={() => navigate(`${PROVISIONING_URL}/${name}/edit`)}
          onDismiss={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
