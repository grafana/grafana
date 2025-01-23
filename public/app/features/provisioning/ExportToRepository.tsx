import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { Button, Field, Input, Legend, Switch } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { Repository, useCreateRepositoryExportMutation, useListJobQuery } from './api';
import { ExportOptions } from './api/types';

interface Props {
  repo: Repository;
}

export function ExportToRepository({ repo }: Props) {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const exportName = exportQuery.data?.metadata?.name;

  const onSubmit: SubmitHandler<ExportOptions> = (body) =>
    exportRepo({
      name: repo.metadata?.name!,
      body, // << the form
    });

  const { register, control, formState, handleSubmit } = useForm<ExportOptions>({
    defaultValues: {
      branch: '*dummy*', // << triggers a fake exporter
      history: true,
      prefix: 'prefix/in/remote/tree',
    },
  });

  if (exportName) {
    return <ExportJobStatus name={exportName} />;
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Legend>Export from grafana into repository</Legend>

        <Field label={'Source folder'} description="Select where we should read data (or empty for everything)">
          <Controller
            control={control}
            name={'folder'}
            render={({ field: { ref, ...field } }) => <FolderPicker {...field} />}
          />
        </Field>

        <Field label="Target Branch" description={'the target branch (use *dummy* to simulate long export)'}>
          <Input placeholder="branch name" {...register('branch')} />
        </Field>

        <Field label="Prefix">
          <Input placeholder="Prefix in the remote system" {...register('prefix')} />
        </Field>

        <Field label="History" description="Include commits for each historical value">
          <Switch {...register('history')} />
        </Field>

        <Button
          type="submit"
          disabled={formState.isSubmitting}
          variant={'secondary'}
          icon={exportQuery.isLoading ? 'spinner' : undefined}
        >
          Export
        </Button>
      </form>
    </>
  );
}

function ExportJobStatus({ name }: { name: string }) {
  const jobQuery = useListJobQuery({ watch: true, fieldSelector: `metadata.name=${name}` });
  const job = jobQuery.data?.items?.[0];

  if (!job) {
    return null;
  }
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
