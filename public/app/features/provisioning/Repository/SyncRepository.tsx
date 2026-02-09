import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { Repository, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';

import { useGetActiveJob } from '../useGetActiveJob';

interface Props {
  repository: Repository;
}

export function SyncRepository({ repository }: Props) {
  const [createJob, jobQuery] = useCreateRepositoryJobsMutation();
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
        disabled={
          jobQuery.isLoading ||
          activeJob?.status?.state === 'working' ||
          !name ||
          !isHealthy ||
          !repository.spec?.sync?.enabled
        }
        onClick={onClick}
      >
        <Trans i18nKey="provisioning.sync-repository.pull">Pull</Trans>
      </Button>
    </>
  );
}
