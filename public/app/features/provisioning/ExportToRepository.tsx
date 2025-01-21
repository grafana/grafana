import { useMemo, useState } from 'react';
import { useObservable } from 'react-use';

import { Button } from '@grafana/ui';

import { ScopedResourceClient } from '../apiserver/client';

import { Repository, RepositorySpec, RepositoryStatus } from './api';

interface Props {
  repo: Repository;
}

export function ExportToRepository({ repo }: Props) {
  const [running, setRunning] = useState(false);

  if (running) {
    return (
      <ExportRunner
        repo={repo.metadata?.name!}
        options={{
          folder: 'folder-uid',
          branch: 'export-branch',
          history: true,
          prefix: 'prefix/in/remote/tree',

          // POST body:
          // branch?: string;
          // folder?: string;
          // history?: boolean;
          // prefix?: string;
        }}
      />
    );
  }

  return (
    <>
      <Button variant={'secondary'} onClick={() => setRunning(true)}>
        export
      </Button>
    </>
  );
}

interface RunnerProps {
  repo: string;
  options: object; // the data object
}

function ExportRunner({ repo, options }: RunnerProps) {
  const client = useMemo(
    () =>
      new ScopedResourceClient<RepositorySpec, RepositoryStatus>({
        group: 'provisioning.grafana.app',
        version: 'v0alpha1',
        resource: 'repositories',
      }),
    []
  );

  const sub = useMemo(
    () => client.watch({ name: repo, path: 'export' }, { data: options, method: 'POST' }),
    [client, options, repo]
  );
  const progress = useObservable(sub);

  return (
    <div>
      <pre>{JSON.stringify(progress, null, 2)}</pre>
    </div>
  );
}
