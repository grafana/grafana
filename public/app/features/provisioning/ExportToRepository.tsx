import { useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { Loader } from '../plugins/admin/components/Loader';

import { Repository, useCreateRepositoryExportMutation } from './api';

interface Props {
  repository: Repository;
}

export function ExportToRepository({ repository }: Props) {
  const [exportResource, exportQuery] = useCreateRepositoryExportMutation();
  const name = repository.metadata?.name;

  useEffect(() => {
    const appEvents = getAppEvents();
    if (exportQuery.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['export started'],
      });
    } else if (exportQuery.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error exporting resources', exportQuery.error],
      });
    }
  }, [exportQuery.error, exportQuery.isError, exportQuery.isSuccess]);

  const onClick = () => {
    if (!name) {
      return;
    }
    exportResource({
      name,
      history: true, // only supported for github
      folder: undefined, // selective export (not yet supported)
    });
  };

  if (exportQuery.isLoading) {
    return <Loader />;
  }

  if (exportQuery.data) {
    return (
      <div>
        <h3>Job queued. TODO: watch until error or complete</h3>
        <pre>{JSON.stringify(exportQuery.data, null, '  ')}</pre>
      </div>
    );
  }

  return (
    <>
      <Button variant={'secondary'} disabled={exportQuery.isLoading || !name} onClick={onClick}>
        export
      </Button>
    </>
  );
}
