import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { AppEvents } from '@grafana/data';
import { config, getAppEvents, getBackendSrv } from '@grafana/runtime';
import { Button, ConfirmModal } from '@grafana/ui';

import { Loader } from '../plugins/admin/components/Loader';

import { useCreateRepositoryImportMutation, useListRepositoryQuery } from './api';

interface Props {
  name?: string;
  folder?: string;
}

export function ImportFromRepository({ name, folder }: Props) {
  const query = useListRepositoryQuery();
  const [importResource, importQuery] = useCreateRepositoryImportMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  // TODO generate endpoints for this
  const { value } = useAsync(async () => {
    return getBackendSrv().get(`/apis/folder.grafana.app/v0alpha1/namespaces/${config.namespace}/folders/${folder}`);
  });

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
    <>
      <Button variant={'secondary'} onClick={() => setIsModalOpen(true)} disabled={importQuery.isLoading || !name}>
        {importQuery.isLoading ? 'Importing...' : 'Import from repository'}
      </Button>
      <ConfirmModal
        isOpen={isModalOpen}
        title={'Import resources from repository'}
        body={`This will pull all resources from the repository into your instance into the "${value?.spec?.title}" folder. Existing dashboards with the same UID will be overwritten. Proceed?`}
        confirmText={'Import'}
        onConfirm={onClick}
        onDismiss={() => setIsModalOpen(false)}
      />
    </>
  );
}
