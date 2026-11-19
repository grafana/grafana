import { textUtil } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, LinkButton, Stack } from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';
import { CORE_KINDS } from 'app/core/kinds/coreKinds';

import { StatusBadge } from '../Shared/StatusBadge';
import { ReadOnlyBadge } from '../components/ReadOnlyBadge';
import { getRepoHrefForProvider } from '../utils/git';
import { getIsReadOnlyWorkflows, getRepositoryEditUrl } from '../utils/repository';
import { getRepositoryTypeConfig } from '../utils/repositoryTypes';

import { SyncRepository } from './SyncRepository';

interface RepositoryActionsProps {
  repository: Repository;
}

export function RepositoryActions({ repository }: RepositoryActionsProps) {
  const name = repository.metadata?.name ?? '';
  const rawRepoHref = getRepoHrefForProvider(repository.spec);
  const repoHref = rawRepoHref ? textUtil.sanitizeUrl(rawRepoHref) : undefined;
  const connectionName = repository.spec?.connection?.name;

  const repoType = repository.spec?.type;
  const repoConfig = repoType ? getRepositoryTypeConfig(repoType) : undefined;
  const providerIcon = repoConfig?.icon || 'external-link-alt';
  const isReadOnlyRepo = getIsReadOnlyWorkflows(repository.spec?.workflows);
  // The repository's resources are contained in a folder named after it.
  const isFolderContained = repository.spec?.sync.target === 'folder';

  return (
    <Stack wrap="wrap" alignItems="center">
      {isReadOnlyRepo && <ReadOnlyBadge repoType={repoType} subject="repository" />}
      <StatusBadge repo={repository} displayOnly />
      {isFolderContained && (
        <LinkButton variant="secondary" icon="folder-open" href={CORE_KINDS.folder.getRoute(name)}>
          <Trans i18nKey="provisioning.repository-actions.view-folder">View folder</Trans>
        </LinkButton>
      )}
      {repoHref && (
        <Button variant="secondary" icon={providerIcon} onClick={() => window.open(repoHref, '_blank')}>
          <Trans i18nKey="provisioning.repository-actions.source-code">Source code</Trans>
        </Button>
      )}
      <SyncRepository repository={repository} />
      {connectionName && (
        <LinkButton
          variant="secondary"
          icon="link"
          href={CORE_KINDS.connection.getRoute(connectionName)}
          onClick={() => {
            reportInteraction('grafana_provisioning_repository_connection_opened', {
              repositoryName: name,
              connectionName,
            });
          }}
        >
          <Trans i18nKey="provisioning.repository-actions.connection">Connection</Trans>
        </LinkButton>
      )}
      <LinkButton
        variant="secondary"
        icon="cog"
        href={getRepositoryEditUrl(name)}
        onClick={() => {
          reportInteraction('grafana_provisioning_repository_settings_opened', {
            repositoryName: name,
            repositoryType: repository.spec?.type ?? 'unknown',
          });
        }}
      >
        <Trans i18nKey="provisioning.repository-actions.settings">Settings</Trans>
      </LinkButton>
    </Stack>
  );
}
