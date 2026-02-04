import { useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';
import { Repository, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { PROVISIONING_URL } from '../constants';
import { useGetActiveJob } from '../useGetActiveJob';

interface Props {
  repository: Repository;
}

export function SyncRepository({ repository }: Props) {
  const [createJob, jobQuery] = useCreateRepositoryJobsMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const name = repository.metadata?.name;
  const activeJob = useGetActiveJob(name);

  const onClick = () => {
    if (!name) {
      return;
    }
    reportInteraction('grafana_provisioning_repository_pull_triggered', {
      repositoryName: name,
      repositoryType: repository.spec?.type ?? 'unknown',
      target: repository.spec?.sync.target ?? 'unknown',
    });
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
        disabled={jobQuery.isLoading || activeJob?.status?.state === 'working' || !name || !isHealthy}
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
