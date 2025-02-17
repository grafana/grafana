import { skipToken } from '@reduxjs/toolkit/query/react';
import { useFormContext } from 'react-hook-form';

import { Button, FieldSet, Stack, Text } from '@grafana/ui';

import { ExportJobStatus } from '../ExportToRepository';
import { useCreateRepositoryExportMutation, useGetRepositoryQuery } from '../api';

import { WizardFormData } from './types';

export function ExportStep() {
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const { watch } = useFormContext<WizardFormData>();
  const [repositoryName, branch] = watch(['repositoryName', 'repository.branch']);
  const exportName = exportQuery.data?.metadata?.name;
  const repositoryQuery = useGetRepositoryQuery(repositoryName ? { name: repositoryName } : skipToken);
  const stats = repositoryQuery?.data?.status?.stats || [];
  const handleExport = () => {
    if (!repositoryName) {
      return;
    }

    exportRepo({
      name: repositoryName,
      body: {
        branch,
        history: true,
        identifier: true,
      },
    });
  };

  if (exportName) {
    return <ExportJobStatus name={exportName} />;
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
