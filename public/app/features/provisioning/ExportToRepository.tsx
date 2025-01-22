import { useState, useEffect } from 'react';

import { Button } from '@grafana/ui';

import { ScopedResourceClient } from '../apiserver/client';

import { Repository, Job, useCreateRepositoryExportMutation, JobSpec, JobStatus } from './api';

interface Props {
  repo: Repository;
}

export function ExportToRepository({ repo }: Props) {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const [job, setJob] = useState<Job>();

  useEffect(() => {
    if (exportQuery.isSuccess) {
      setJob(exportQuery.data);

      const name = exportQuery.data.metadata?.name!;
      console.log('Start watching: ', name);
      const client = new ScopedResourceClient<JobSpec, JobStatus>({
        group: 'provisioning.grafana.app',
        version: 'v0alpha1',
        resource: 'jobs',
      });
      client.watch({ name }).subscribe((v) => {
        const state = v.object.status?.state;
        console.log('GOT: ', state, v);
        if (v.object) {
          setJob(v.object as Job);
        }
        if (state === 'success' || state === 'error') {
          console.warn('TODO, unsubscribe job:', name);
        }
      });
    }
  }, [exportQuery.isSuccess, exportQuery.data]);

  if (job) {
    return (
      <div>
        {/** https://codepen.io/tmac/pen/QgVRKb  ??? */}
        {job.status && (
          <div>
            <div>
              {job.status.message} // {job.status.state}
              {job.status.progress && (
                <div
                  style={{
                    background: '#999',
                    width: '400px',
                    height: '10px',
                  }}
                >
                  <div
                    style={{
                      background: 'green',
                      width: `${job.status.progress}%`,
                      height: '10px',
                    }}
                  >
                    &nbsp;
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <br />
        <br />
        <pre>{JSON.stringify(job, null, '  ')}</pre>
      </div>
    );
  }

  return (
    <>
      <Button
        variant={'secondary'}
        icon={exportQuery.isLoading ? 'spinner' : undefined}
        disabled={exportQuery.isLoading}
        onClick={() =>
          exportRepo({
            name: repo.metadata?.name!,
            body: {
              branch: '*dummy*', // << triggers a fake exporter
              folder: 'some-folder',
              history: true,
              prefix: 'prefix/in/remote/tree',
            },
          })
        }
      >
        Export
      </Button>
    </>
  );
}
