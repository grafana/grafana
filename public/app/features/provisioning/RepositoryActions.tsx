import { Button, LinkButton, Stack } from '@grafana/ui';

import { DeleteRepositoryButton } from './DeleteRepositoryButton';
import { StatusBadge } from './StatusBadge';
import { SyncRepository } from './SyncRepository';
import { Repository } from './api';
import { PROVISIONING_URL } from './constants';
import { getRepoHref } from './utils/git';

interface RepositoryActionsProps {
  repository: Repository;
  showMigrateButton?: boolean;
  onExportClick?: () => void;
  onMigrateClick?: () => void;
}

export function RepositoryActions({
  repository,
  showMigrateButton,
  onExportClick,
  onMigrateClick,
}: RepositoryActionsProps) {
  const name = repository.metadata?.name ?? '';
  const repoHref = getRepoHref(repository.spec?.github);

  return (
    <Stack>
      <StatusBadge
        enabled={Boolean(repository.spec?.sync?.enabled)}
        state={repository.status?.sync?.state}
        name={name}
      />
      {repoHref && (
        <Button variant="secondary" icon="github" onClick={() => window.open(repoHref, '_blank')}>
          Source Code
        </Button>
      )}
      <SyncRepository repository={repository} />
      {showMigrateButton ? (
        <Button variant="secondary" icon="cloud-upload" onClick={onMigrateClick}>
          Migrate
        </Button>
      ) : (
        <Button variant="secondary" icon="cloud-upload" onClick={onExportClick}>
          Push
        </Button>
      )}
      <LinkButton variant="secondary" icon="cog" href={`${PROVISIONING_URL}/${name}/edit`}>
        Settings
      </LinkButton>
      <DeleteRepositoryButton name={name} redirectTo={PROVISIONING_URL} />
    </Stack>
  );
}
