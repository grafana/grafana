import { useState, useEffect } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { Button, Field, Input, Legend, Switch } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import { ScopedResourceClient } from '../apiserver/client';

import { Repository, Job, useCreateRepositoryExportMutation, JobSpec, JobStatus } from './api';
import { ExportOptions } from './api/types';

interface Props {
  repo: Repository;
}

export function ExportToRepository({ repo }: Props) {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const [job, setJob] = useState<Job>();

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
      <br />
      <br />
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
