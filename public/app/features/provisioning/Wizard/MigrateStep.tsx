import { skipToken } from '@reduxjs/toolkit/query/react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Button, FieldSet, Stack, Text, Switch, Field } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositoryMigrateMutation, useGetRepositoryQuery } from '../api';

import { WizardFormData } from './types';

export function MigrateStep() {
  const [migrateRepo, migrateQuery] = useCreateRepositoryMigrateMutation();
  const [showMigrateStatus, setShowMigrateStatus] = useState(false);
  const { watch, register } = useFormContext<WizardFormData>();
  const [repositoryName, history, identifier] = watch(['repositoryName', 'export.history', 'export.identifier']);
  const migrateName = migrateQuery.data?.metadata?.name;
  const repositoryQuery = useGetRepositoryQuery(repositoryName ? { name: repositoryName } : skipToken);
  const stats = repositoryQuery?.data?.status?.stats || [];

  const handleMigrate = async () => {
    if (!repositoryName) {
      return;
    }

    await migrateRepo({
      name: repositoryName,
      body: {
        identifier,
        history,
      },
    });
    setShowMigrateStatus(true);
  };

  const onAbort = () => {
    migrateQuery.reset();
    setShowMigrateStatus(false);
  };

  if (showMigrateStatus && migrateName) {
    return (
      <Stack direction="column" gap={2}>
        <JobStatus name={migrateName} />
        <Stack gap={2}>
          <Button variant="secondary" onClick={onAbort}>
            Abort migration
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <FieldSet label="3. Migrate dashboards">
      <Stack direction={'column'} gap={2}>
        <Text color="secondary">
          Migrate all dashboards from this instance to your repository. After this one-time migration, all future
          updates will be automatically saved to the repository.
        </Text>

        <Stack direction={'column'} width={'300px'}>
          <Text>Resources to migrate:</Text>
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
            onClick={handleMigrate}
            disabled={migrateQuery.isLoading || !repositoryName}
            icon={migrateQuery.isLoading ? 'spinner' : undefined}
          >
            {migrateQuery.isLoading ? 'Migrating...' : 'Start migration'}
          </Button>
        </Stack>
      </Stack>
    </FieldSet>
  );
}
