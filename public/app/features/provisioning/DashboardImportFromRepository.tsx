import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { FieldSet, Field, Combobox, Button } from '@grafana/ui';

import { Loader } from '../plugins/admin/components/Loader';

import { useCreateRepositoryImportMutation, useListRepositoryQuery } from './api';

interface Props {
  repository?: string;
}

export function DashboardImportFromRepository({ repository }: Props) {
  const query = useListRepositoryQuery();
  const [importDashboard, importQuery] = useCreateRepositoryImportMutation();
  const { handleSubmit, control } = useForm();
  const navigate = useNavigate();

  useEffect(() => {
    const appEvents = getAppEvents();
    if (importQuery.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Dashboard imported'],
      });
      console.log('q', importQuery);
    } else if (importQuery.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error importing dashboard', importQuery.error],
      });
    }
  }, [importQuery.error, importQuery.isError, importQuery.isSuccess]);

  const onSubmit = ({ repository }: { repository?: string }) => {
    if (!repository) {
      return;
    }

    importDashboard({ name: repository, ref: 'main' });
  };

  if (query.isLoading) {
    return <Loader />;
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ paddingTop: 100 }}>
      <FieldSet label={'Import from repository'}>
        <Field label={'Repository'}>
          <Controller
            control={control}
            name={'repository'}
            render={({ field: { ref, onChange, ...field } }) => {
              return (
                <Combobox
                  {...field}
                  placeholder={'My GitHub repository'}
                  onChange={(value) => onChange(value?.value)}
                  options={
                    query.data?.items.map((item) => ({ value: item.metadata.name, label: item.spec.title })) || []
                  }
                />
              );
            }}
          />
        </Field>
      </FieldSet>

      <Button type="submit" disabled={importQuery.isLoading}>
        {importQuery.isLoading ? 'Importing...' : 'Import'}
      </Button>
    </form>
  );
}
