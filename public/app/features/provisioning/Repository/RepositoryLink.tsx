import { skipToken } from '@reduxjs/toolkit/query';

import { Stack, Text, TextLink } from '@grafana/ui';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { getRepoHref } from '../utils/git';

type RepositoryLinkProps = {
  name?: string;
};

export function RepositoryLink({ name }: RepositoryLinkProps) {
  const repoQuery = useGetRepositoryQuery(name ? { name } : skipToken);
  const repo = repoQuery.data;

  if (!repo || repoQuery.isLoading) {
    return null;
  }

  const repoHref = getRepoHref(repo.spec?.github);

  return (
    <Stack direction="column" gap={1}>
      <Text>
        <Trans i18nKey="provisioning.repository-link.grafana-repository-synced">
          Your resources are now in your external storage and provisioned into your instance. From now on, your instance
          and the external storage will be synchronized.
        </Trans>
      </Text>
      {repoHref && (
        <Stack direction="row" gap={2}>
          <TextLink href={repoHref} external>
            <Trans i18nKey="provisioning.repository-link.view-repository">View repository</Trans>
          </TextLink>
        </Stack>
      )}
    </Stack>
  );
}
