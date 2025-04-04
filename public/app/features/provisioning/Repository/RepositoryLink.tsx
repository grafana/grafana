import { skipToken } from '@reduxjs/toolkit/query';

import { LinkButton, Stack, Text } from '@grafana/ui';
import { useGetRepositoryQuery } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { getRepoHref } from '../utils/git';

type RepositoryLinkProps = {
  name?: string;
};

export function RepositoryLink({ name }: RepositoryLinkProps) {
  const repoQuery = useGetRepositoryQuery(name ? { name } : skipToken);
  const repo = repoQuery.data;

  if (!repo || repoQuery.isLoading || repo.spec?.type !== 'github' || !repo.spec?.github?.url) {
    return null;
  }

  const repoHref = getRepoHref(repo.spec?.github);
  const folderHref = repo.spec?.sync.target === 'folder' ? `/dashboards/f/${repo.metadata?.name}` : '/dashboards';

  if (!repoHref) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <Text>
        <Trans i18nKey="provisioning.repository-link.grafana-repository">
          Grafana and your repository are now in sync.
        </Trans>
      </Text>
      <Stack direction="row" gap={2}>
        <LinkButton fill="outline" href={repoHref} icon="external-link-alt" target="_blank" rel="noopener noreferrer">
          <Trans i18nKey="provisioning.repository-link.view-repository">View repository</Trans>
        </LinkButton>
        <LinkButton fill="outline" href={folderHref} icon="folder-open">
          <Trans i18nKey="provisioning.repository-link.view-folder">View folder</Trans>
        </LinkButton>
      </Stack>
    </Stack>
  );
}
