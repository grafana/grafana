import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Dropdown, Icon, Menu, Stack } from '@grafana/ui';
import { type Repository, useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning/v0alpha1';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { useGetActiveJob } from '../useGetActiveJob';

interface Props {
  repository: Repository;
}

export function SyncRepository({ repository }: Props) {
  const [createJob, jobQuery] = useCreateRepositoryJobsMutation();
  const name = repository.metadata?.name;
  const activeJob = useGetActiveJob(name);

  const triggerPull = (incremental: boolean) => {
    if (!name) {
      return;
    }
    reportInteraction('grafana_provisioning_repository_pull_triggered', {
      repositoryName: name,
      repositoryType: repository.spec?.type ?? 'unknown',
      target: repository.spec?.sync.target ?? 'unknown',
      incremental,
    });
    createJob({
      name,
      jobSpec: {
        action: 'pull',
        pull: {
          incremental,
        },
      },
    });
  };

  const confirmFullPull = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('provisioning.sync-repository.title-force-full-pull', 'Force full pull?'),
        text: t(
          'provisioning.sync-repository.confirm-force-full-pull',
          'Are you sure you want to do a full pull? This may take a while, so only continue if you have resources that are unexpectedly not syncing.'
        ),
        yesText: t('provisioning.sync-repository.button-force-full-pull', 'Force full pull'),
        noText: t('provisioning.sync-repository.button-cancel', 'Cancel'),
        onConfirm: () => triggerPull(false),
      })
    );
  };

  const isHealthy = Boolean(repository.status?.health.healthy);
  const isBusy = jobQuery.isLoading || activeJob?.status?.state === 'working' || activeJob?.status?.state === 'pending';
  const disabled = isBusy || !name || !isHealthy;

  const menu = (
    <Menu>
      <Menu.Item
        label={t('provisioning.sync-repository.pull-diff', 'Pull based on diff (default)')}
        onClick={() => triggerPull(true)}
      />
      <Menu.Item label={t('provisioning.sync-repository.pull-full', 'Force full pull')} onClick={confirmFullPull} />
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-start">
      <Button
        icon="cloud-download"
        variant="secondary"
        tooltip={
          isHealthy
            ? undefined
            : t('provisioning.sync-repository.tooltip-unhealthy-repository', 'Unable to pull an unhealthy repository')
        }
        disabled={disabled}
      >
        <Stack alignItems="center" gap={0.5}>
          <Trans i18nKey="provisioning.sync-repository.pull">Pull</Trans>
          <Icon name="angle-down" />
        </Stack>
      </Button>
    </Dropdown>
  );
}
