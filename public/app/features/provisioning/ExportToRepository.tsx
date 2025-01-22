import { useState, useEffect } from 'react';

import { Button } from '@grafana/ui';

import { Repository, Job, useCreateRepositoryExportMutation } from './api';

interface Props {
  repo: Repository;
}

export function ExportToRepository({ repo }: Props) {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const [job, setJob] = useState<Job>();

  useEffect(() => {
    if (exportQuery.isSuccess) {
      setJob(exportQuery.data);
    }
  }, [exportQuery.isSuccess, exportQuery.data]);

  if (job) {
    return (
      <div>
        <h5>TODO... watch and update until done</h5>
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
              branch: 'my-branch',
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
