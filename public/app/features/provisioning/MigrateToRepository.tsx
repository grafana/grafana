import { useForm } from 'react-hook-form';

import { Box, Button, Field, FieldSet, Input, Stack, Switch, Text } from '@grafana/ui';

import ProgressBar from './ProgressBar';
import { Repository, useCreateRepositoryMigrateMutation, useListJobQuery, MigrateJobOptions } from './api';

interface Props {
  repo: Repository;
}

export function MigrateToRepository({ repo }: Props) {
  const [migrateRepo, migrateQuery] = useCreateRepositoryMigrateMutation();
  const migrateJob = migrateQuery.data?.metadata?.name;

  const { register, formState, handleSubmit } = useForm<MigrateJobOptions>({
    defaultValues: {
      history: true,
      prefix: '',
    },
  });

  const onSubmit = (body: MigrateJobOptions) =>
    migrateRepo({
      name: repo.metadata?.name ?? '',
      body, // << the form
    });

  if (migrateJob) {
    return <MigrateJobStatus name={migrateJob} />;
  }

  return (
    <Box paddingTop={2}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldSet label="Migrate instance so it is managed from repository">
          <Field label="Prefix">
            <Input placeholder="Prefix in the remote system" {...register('prefix')} />
          </Field>

          <Field label="Identifier" description="Include the current identifier in migrateed metadata">
            <Switch {...register('identifier')} />
          </Field>

          <Field label="History" description="Include commits for each historical value">
            <Switch {...register('history')} />
          </Field>

          <Button
            type="submit"
            disabled={formState.isSubmitting}
            variant={'secondary'}
            icon={migrateQuery.isLoading ? 'spinner' : undefined}
          >
            Migrate
          </Button>
        </FieldSet>
      </form>
    </Box>
  );
}

function MigrateJobStatus({ name }: { name: string }) {
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
