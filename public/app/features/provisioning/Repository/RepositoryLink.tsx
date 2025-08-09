import { skipToken } from '@reduxjs/toolkit/query';

import { Trans } from '@grafana/i18n';
import { LinkButton, Stack, Text, TextLink } from '@grafana/ui';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';

import { getRepoHref } from '../utils/git';

type RepositoryLinkProps = {
  name?: string;
  jobType: 'sync' | 'delete' | 'move';
};

export function RepositoryLink({ name, jobType }: RepositoryLinkProps) {
  const repoQuery = useGetRepositoryQuery(name ? { name } : skipToken);
  const repo = repoQuery.data;

  if (!repo || repoQuery.isLoading) {
    return null;
  }

  const repoHref = getRepoHref(repo.spec?.github);

  if (jobType === 'sync') {
    return (
      <>
        <Text>
          <Trans i18nKey="provisioning.repository-link.grafana-repository-synced">
            Your resources are now in your external storage and provisioned into your instance. From now on, your
            instance and the external storage will be synchronized.
          </Trans>
        </Text>

        {repoHref && (
          <Stack direction="row" gap={2}>
            <TextLink href={repoHref} external>
              <Trans i18nKey="provisioning.repository-link.sync-job.view-repository">View repository</Trans>
            </TextLink>
          </Stack>
        )}
      </>
    );
  }

  return (
    <>
      {repoHref && (
        <Stack direction="row" gap={2}>
          <LinkButton href={repoHref} icon="external-link-alt" variant="secondary" target="_blank">
            <Trans i18nKey="provisioning.repository-link.delete-or-move-job.view-repository">View repository</Trans>
          </LinkButton>
        </Stack>
      )}
    </>
  );
}
