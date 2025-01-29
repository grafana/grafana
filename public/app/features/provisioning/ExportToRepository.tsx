import { Controller, useForm } from 'react-hook-form';

import { Box, Button, Field, FieldSet, Input, Stack, Switch, Text } from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';

import ProgressBar from './ProgressBar';
import { Repository, useCreateRepositoryExportMutation, useListJobQuery, ExportJobOptions } from './api';

interface Props {
  repo: Repository;
}

export function ExportToRepository({ repo }: Props) {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const exportName = exportQuery.data?.metadata?.name;

  const { register, control, formState, handleSubmit } = useForm<ExportJobOptions>({
    defaultValues: {
      branch: '*dummy*', // << triggers a fake exporter
      history: true,
      prefix: 'prefix/in/remote/tree',
    },
  });

  const onSubmit = (body: ExportJobOptions) =>
    exportRepo({
      name: repo.metadata?.name ?? '',
      body, // << the form
    });

  if (exportName) {
    return <ExportJobStatus name={exportName} />;
  }

  return (
    <Box paddingTop={2}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet label="Export from grafana into repository">
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
        </FieldSet>
      </form>
    </Box>
  );
}

function ExportJobStatus({ name }: { name: string }) {
  const jobQuery = useListJobQuery({ watch: true, fieldSelector: `metadata.name=${name}` });
  const job = jobQuery.data?.items?.[0];

  if (!job) {
    return null;
  }

  return (
    <Box paddingTop={2}>
      <Stack direction={'column'} gap={2}>
        {job.status && (
          <Stack direction="column" gap={2}>
            <Text element="p">
              {job.status.message} // {job.status.state}
            </Text>
            <ProgressBar progress={job.status.progress} />
          </Stack>
        )}
        <pre>{JSON.stringify(job, null, ' ')}</pre>
      </Stack>
    </Box>
  );
}
