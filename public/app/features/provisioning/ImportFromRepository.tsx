import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { Loader } from '../plugins/admin/components/Loader';

import { useCreateRepositoryImportMutation, useListRepositoryQuery } from './api';

interface Props {
  name?: string;
  folder?: string;
}

export function ImportFromRepository({ name, folder }: Props) {
  const query = useListRepositoryQuery();
  const [importResource, importQuery] = useCreateRepositoryImportMutation();
  const navigate = useNavigate();

  useEffect(() => {
    const appEvents = getAppEvents();
    if (importQuery.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Resources imported'],
      });
      // TODO the URL will be different based on the type of resource imported
      navigate(`/dashboards${folder ? `/f/${folder}` : ''}`);
    } else if (importQuery.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error importing resources', importQuery.error],
      });
    }
  }, [folder, importQuery.error, importQuery.isError, importQuery.isSuccess, navigate]);

  const onClick = () => {
    if (!name) {
      return;
    }

    importResource({ name, ref: 'main' });
  };

  if (query.isLoading) {
    return <Loader />;
  }
  return (
    <Button variant={'secondary'} onClick={onClick} disabled={importQuery.isLoading || !name}>
      {importQuery.isLoading ? 'Importing...' : 'Import from repository'}
    </Button>
  );
}
