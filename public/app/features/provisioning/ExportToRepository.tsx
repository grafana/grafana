import { useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { from, catchError, filter, map, mergeMap } from 'rxjs';

import { getBackendSrv, config } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { Repository, JobProgressMessage } from './api';

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
  const observer = useMemo(() => {
    console.log('START EXPORT', { repo, options });
    return getBackendSrv()
      .chunked({
        url: `/apis/provisioning.grafana.app/v0alpha1/namespaces/${config.namespace}/repositories/${repo}/export`,
        method: 'POST',
        data: options, // THE POST BODY
      })
      .pipe(
        filter((response) => response.ok && response.data instanceof Uint8Array),
        map((response) => {
          const decoder = new TextDecoder();
          const text = decoder.decode(response.data);
          return text.split('\n');
        }),
        mergeMap((text) => from(text)),
        filter((line) => line.length > 0),
        map((line) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.warn('Invalid JSON in watch stream:', e);
            return null;
          }
        }),
        filter((event): event is JobProgressMessage => event !== null),
        catchError((error) => {
          console.error('Watch stream error:', error);
          throw error;
        })
      );
  }, [repo, options]);

  const progress = useObservable(observer);
  return (
    <div>
      <pre>{JSON.stringify(progress, null, '  ')}</pre>
    </div>
  );
}
