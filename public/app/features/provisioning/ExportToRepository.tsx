import { useForm } from 'react-hook-form';

import { Box, Button, Field, Input, Switch } from '@grafana/ui';

import { JobStatus } from './JobStatus';
import { Repository, useCreateRepositoryExportMutation, ExportJobOptions } from './api';

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
    return <JobStatus name={exportJob} />;
  }

  const isGit = repo.spec?.type === 'github';

  return (
    <Box paddingTop={2}>
      <form onSubmit={handleSubmit(onSubmit)}>
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
      </form>
    </Box>
  );
}
