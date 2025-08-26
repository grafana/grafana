import { t, Trans } from '@grafana/i18n';
import { Badge, Button, LinkButton, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { StatusBadge } from '../Shared/StatusBadge';
import { PROVISIONING_URL } from '../constants';
import { getRepoHrefForProvider } from '../utils/git';
import { getIsReadOnlyWorkflows } from '../utils/repository';
import { getRepositoryTypeConfig } from '../utils/repositoryTypes';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { SyncRepository } from './SyncRepository';

interface RepositoryActionsProps {
  repository: Repository;
}

export function RepositoryActions({ repository }: RepositoryActionsProps) {
  const name = repository.metadata?.name ?? '';
  const repoHref = getRepoHrefForProvider(repository.spec);

  const repoType = repository.spec?.type;
  const repoConfig = repoType ? getRepositoryTypeConfig(repoType) : undefined;
  const providerIcon = repoConfig?.icon || 'external-link-alt';
  const isReadOnlyRepo = getIsReadOnlyWorkflows(repository.spec?.workflows);

  return (
    <Stack>
      {isReadOnlyRepo && <Badge color="darkgrey" text={t('folder-repo.read-only-badge', 'Read only')} />}
      <StatusBadge repo={repository} />
      {repoHref && (
        <Button variant="secondary" icon={providerIcon} onClick={() => window.open(repoHref, '_blank')}>
          <Trans i18nKey="provisioning.repository-actions.source-code">Source code</Trans>
        </Button>
      )}
      <SyncRepository repository={repository} />
      <LinkButton variant="secondary" icon="cog" href={`${PROVISIONING_URL}/${name}/edit`}>
        <Trans i18nKey="provisioning.repository-actions.settings">Settings</Trans>
      </LinkButton>
      <DeleteRepositoryButton name={name} repository={repository} redirectTo={PROVISIONING_URL} />
    </Stack>
  );
}
