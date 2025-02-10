import { Stack, Text } from '@grafana/ui';

import { Repository } from './api';
import { formatTimestamp } from './utils/time';

export function RepositorySyncStatus({ repo }: { repo: Repository }) {
  const status = repo.status;
  return (
    <Stack gap={2} direction="column" alignItems={'flex-start'}>
      <ul style={{ listStyle: 'none' }}>
        <li>
          Job ID: <b>{status?.sync.job ?? 'N/A'}</b>
        </li>
        <li>
          Last Ref: <b>{status?.sync.hash ?? 'N/A'}</b>
        </li>
        <li>
          Started: <b>{formatTimestamp(status?.sync.started)}</b>
        </li>
        <li>
          Finished: <b>{formatTimestamp(status?.sync.finished)}</b>
        </li>
      </ul>

      {status?.sync?.message && status.sync.message.length > 0 && (
        <>
          <Text>Messages:</Text>
          <ul style={{ listStyle: 'none' }}>
            {status.sync.message.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </>
      )}
    </Stack>
  );
}
