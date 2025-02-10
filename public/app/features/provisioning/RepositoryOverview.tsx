import { Stack } from '@grafana/ui';

import { RepositoryHealth } from './RepositoryHealth';
import { RepositorySyncStatus } from './RepositorySyncStatus';
import { Repository } from './api';

export function RepositoryOverview({ repo }: { repo: Repository }) {
  return (
    <Stack grow={1} direction={'column'} gap={2}>
      <h2>Health</h2>
      <RepositoryHealth repo={repo} />
      <h2>Sync Status</h2>
      <RepositorySyncStatus repo={repo} />
    </Stack>
  );
}
