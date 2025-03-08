import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Box, Button, Field, Input, Stack, Switch } from '@grafana/ui';

import { JobStatus } from './JobStatus';
import { Repository, useCreateRepositoryExportMutation, ExportJobOptions } from './api';

interface Props {
  repo: Repository;
}

export function ExportToRepository({ repo }: Props) {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const [showExportStatus, setShowExportStatus] = useState(false);
  const exportJob = exportQuery.data?.metadata?.name;

  const { register, formState, handleSubmit } = useForm<ExportJobOptions>({
    defaultValues: {
      prefix: '',
    },
  });

  const onSubmit = async (body: ExportJobOptions) => {
    await exportRepo({
      name: repo.metadata?.name ?? '',
      body, // << the form
    });
    setShowExportStatus(true);
  };

  const onAbort = () => {
    exportQuery.reset();
    setShowExportStatus(false);
  };

  if (showExportStatus && exportJob) {
    return (
      <Box paddingTop={2}>
        <Stack direction="column" gap={2}>
          <JobStatus name={exportJob} />
          <Stack gap={2}>
            <Button variant="secondary" onClick={onAbort}>
              Abort export
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
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
