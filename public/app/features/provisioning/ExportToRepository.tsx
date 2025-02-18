import { useForm } from 'react-hook-form';

import { Box, Button, Field, FieldSet, Input, Stack, Switch, Text } from '@grafana/ui';

import ProgressBar from './ProgressBar';
import { Repository, useCreateRepositoryExportMutation, useListJobQuery, ExportJobOptions } from './api';

interface Props {
  repo: Repository;
}

export function ExportToRepository({ repo }: Props) {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const exportJob = exportQuery.data?.metadata?.name;

  const { register, formState, handleSubmit } = useForm<ExportJobOptions>({
    defaultValues: {
      prefix: '',
    },
  });

  const onSubmit = (body: ExportJobOptions) =>
    exportRepo({
      name: repo.metadata?.name ?? '',
      body, // << the form
    });

  if (exportJob) {
    return <ExportJobStatus name={exportJob} />;
  }

  const isGit = repo.spec?.type === 'github';

  return (
    <Box paddingTop={2}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet label="Export from grafana into repository">
          {isGit && (
            <Field label="Target Branch" description={'The target branch.  This will be created and emptied first'}>
              <Input placeholder={repo.spec?.github?.branch} {...register('branch')} />
            </Field>
          )}

          <Field label="Prefix">
            <Input placeholder="Prefix in the remote system" {...register('prefix')} />
          </Field>

          <Field label="Identifier" description="Include the current identifier in exported metadata">
            <Switch {...register('identifier')} />
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
