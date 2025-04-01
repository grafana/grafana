import { Button, LinkButton, Stack } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { StatusBadge } from '../Shared/StatusBadge';
import { PROVISIONING_URL } from '../constants';
import { getRepoHref } from '../utils/git';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { SyncRepository } from './SyncRepository';

interface RepositoryActionsProps {
  repository: Repository;
}

export function RepositoryActions({ repository }: RepositoryActionsProps) {
  const name = repository.metadata?.name ?? '';
  const repoHref = getRepoHref(repository.spec?.github);

  return (
    <Stack>
      <StatusBadge repo={repository} />
      {repoHref && (
        <Button variant="secondary" icon="github" onClick={() => window.open(repoHref, '_blank')}>
          <Trans i18nKey="provisioning.repository-actions.source-code">Source Code</Trans>
        </Button>
      )}
      <SyncRepository repository={repository} />
      <LinkButton variant="secondary" icon="cog" href={`${PROVISIONING_URL}/${name}/edit`}>
        <Trans i18nKey="provisioning.repository-actions.settings">Settings</Trans>
      </LinkButton>
      <DeleteRepositoryButton name={name} redirectTo={PROVISIONING_URL} />
    </Stack>
  );
}
