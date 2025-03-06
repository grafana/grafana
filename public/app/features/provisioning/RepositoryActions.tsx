import { Button, LinkButton, Stack } from '@grafana/ui';
import { Repository } from './api';
import { PROVISIONING_URL } from './constants';
import { SyncRepository } from './SyncRepository';
import { getRemoteURL } from './utils/git';
import { StatusBadge } from './StatusBadge';
import { DeleteRepositoryButton } from './DeleteRepositoryButton';

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
  const remoteURL = getRemoteURL(repository);
  const name = repository.metadata?.name ?? '';

  return (
    <Stack>
      <StatusBadge
        enabled={Boolean(repository.spec?.sync?.enabled)}
        state={repository.status?.sync?.state}
        name={name}
      />
      {remoteURL && (
        <Button variant="secondary" icon="github" onClick={() => window.open(remoteURL, '_blank')}>
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
      <DeleteRepositoryButton name={name} />
    </Stack>
  );
}
