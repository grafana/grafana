import { skipToken } from '@reduxjs/toolkit/query/react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Button, FieldSet, Stack, Text, Switch, Field } from '@grafana/ui';

import { ExportJobStatus } from '../ExportToRepository';
import { useCreateRepositoryExportMutation, useGetRepositoryQuery } from '../api';

import { WizardFormData } from './types';

export function ExportStep() {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const [showExportStatus, setShowExportStatus] = useState(false);
  const { watch, register } = useFormContext<WizardFormData>();
  const [repositoryName, branch, history, identifier] = watch([
    'repositoryName',
    'repository.branch',
    'export.history',
    'export.identifier',
  ]);
  const exportName = exportQuery.data?.metadata?.name;
  const repositoryQuery = useGetRepositoryQuery(repositoryName ? { name: repositoryName } : skipToken);
  const stats = repositoryQuery?.data?.status?.stats || [];

  const handleExport = async () => {
    if (!repositoryName) {
      return;
    }

    await exportRepo({
      name: repositoryName,
      body: {
        branch,
        history,
        identifier,
      },
    });
    setShowExportStatus(true);
  };

  const onAbort = () => {
    exportQuery.reset();
    setShowExportStatus(false);
  };

  if (showExportStatus && exportName) {
    return (
      <Stack direction="column" gap={2}>
        <ExportJobStatus name={exportName} />
        <Stack gap={2}>
          <Button variant="secondary" onClick={onAbort}>
            Abort export
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <FieldSet label="3. Export dashboards">
      <Stack direction={'column'} gap={2}>
        <Text color="secondary">
          Export all dashboards from this instance to your repository. After this one-time export, all future updates
          will be automatically saved to the repository.
        </Text>

        <Stack direction={'column'} width={'300px'}>
          <Text>Resources to export:</Text>
          {Boolean(stats.length) &&
            stats.map((stat) => {
              return (
                <Stack justifyContent={'space-between'} key={stat.group}>
                  <Text>{stat.resource}:</Text>
                  <Text>{stat.count}</Text>
                </Stack>
              );
            })}
        </Stack>

        <FieldSet>
          <Field label="Identifier" description="Include the current identifier in exported metadata">
            <Switch {...register('export.identifier')} />
          </Field>

          <Field label="History" description="Include commits for each historical value">
            <Switch {...register('export.history')} />
          </Field>
        </FieldSet>

        <Stack alignItems={'flex-start'}>
          <Button
            onClick={handleExport}
            disabled={exportQuery.isLoading || !repositoryName}
            icon={exportQuery.isLoading ? 'spinner' : undefined}
          >
            Export dashboards
          </Button>
        </Stack>
      </Stack>
    </FieldSet>
  );
}
