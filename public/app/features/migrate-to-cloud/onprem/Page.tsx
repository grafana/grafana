import { skipToken } from '@reduxjs/toolkit/query/react';
import React, { useCallback, useMemo } from 'react';

import { Box, Button, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import {
  MigrateDataResponseItemDto,
  useGetCloudMigrationRunListQuery,
  useGetCloudMigrationRunQuery,
  useGetMigrationListQuery,
  useRunCloudMigrationMutation,
} from '../api';
import { MigrationResourceDTOMock } from '../mockAPI';

import { EmptyState } from './EmptyState/EmptyState';
import { MigrationInfo } from './MigrationInfo';
import { ResourcesTable } from './ResourcesTable';

/**
 * Here's how migrations work:
 *
 * A single on-prem instance can be configured to be migrated to multiple cloud instances.
 *  - GetMigrationList returns this the list of migration targets for the on prem instance
 *  - If GetMigrationList returns an empty list, then the empty state with a prompt to enter a token should be shown
 *  - The UI (at the moment) only shows the most recently created migration target (the last one returned from the API)
 *    and doesn't allow for others to be created
 *
 * A single on-prem migration 'target' (CloudMigrationResponse) can have multiple migration runs (CloudMigrationRun)
 *  - To list the migration resources:
 *      1. call GetCloudMigratiopnRunList to list all runs
 *      2. call GetCloudMigrationRun with the ID from first step to list the result of that migration
 */

function useGetLatestMigrationDestination() {
  const result = useGetMigrationListQuery();
  const latestMigration = result.data?.migrations?.[0];

  return {
    ...result,
    data: latestMigration,
  };
}

function useGetLatestMigrationRun(migrationId?: number) {
  const listResult = useGetCloudMigrationRunListQuery(migrationId ? { id: migrationId } : skipToken);
  const latestMigrationRun = listResult.data?.runs?.[0];

  const runResult = useGetCloudMigrationRunQuery(
    latestMigrationRun?.id && migrationId ? { runId: latestMigrationRun.id, id: migrationId } : skipToken
  );

  return {
    ...runResult,

    data: runResult.data,

    error: listResult.error || runResult.error,

    isError: listResult.isError || runResult.isError,
    isLoading: listResult.isLoading || runResult.isLoading,
    isFetching: listResult.isFetching || runResult.isFetching,
  };
}

export const Page = () => {
  const migrationDestination = useGetLatestMigrationDestination();
  const migrationRun = useGetLatestMigrationRun(migrationDestination.data?.id);
  const [actuallyRunMigration, actuallyRunMigrationResult] = useRunCloudMigrationMutation();

  console.log('migrationList', migrationDestination);
  console.log('migrationRun', migrationRun);
  console.log('actuallyRunMigrationResult', actuallyRunMigrationResult);

  const isBusy = actuallyRunMigrationResult.isLoading || migrationDestination.isFetching || migrationRun.isFetching;
  const resources: MigrationResourceDTOMock[] = [];

  const newResources = useMemo(() => {
    if (!migrationRun.data) {
      return undefined;
    }

    const rawResources: Array<MigrateDataResponseItemDto & { type: string }> = JSON.parse(
      /// @ts-expect-error
      atob(migrationRun.data.result)
    );

    return rawResources;
  }, [migrationRun.data]);

  console.log('migration run resources', newResources);

  const handleDisconnect = useCallback(() => {
    window.alert('TODO: Disconnect');
  }, []);

  const handleStartMigration = useCallback(() => {
    if (migrationDestination.data?.id) {
      actuallyRunMigration({ id: migrationDestination.data?.id });
    } else {
      window.alert('id still aint there');
    }
  }, [actuallyRunMigration, migrationDestination]);

  const migrationMeta = migrationDestination.data;
  const isInitialLoading = migrationDestination.isLoading;
  if (isInitialLoading) {
    // TODO: better loading state
    return <div>Loading...</div>;
  } else if (!migrationMeta) {
    return <EmptyState />;
  }

  return (
    <>
      <Stack direction="column" gap={4}>
        {/* {startMigrationIsError && (
          <Alert
            severity="error"
            title={t(
              'migrate-to-cloud.summary.error-starting-migration',
              'There was an error starting cloud migration'
            )}
          />
        )} */}

        {migrationMeta.stack && (
          <Box
            borderColor="weak"
            borderStyle="solid"
            padding={2}
            display="flex"
            gap={4}
            alignItems="center"
            justifyContent="space-between"
          >
            <MigrationInfo
              title={t('migrate-to-cloud.summary.target-stack-title', 'Uploading to')}
              value={
                <>
                  {migrationMeta.stack}{' '}
                  <Button onClick={handleDisconnect} disabled={isBusy} variant="secondary" size="sm">
                    <Trans i18nKey="migrate-to-cloud.summary.disconnect">Disconnect</Trans>
                  </Button>
                </>
              }
            />

            <Button
              disabled={isBusy}
              onClick={handleStartMigration}
              icon={actuallyRunMigrationResult.isLoading ? 'spinner' : undefined}
            >
              <Trans i18nKey="migrate-to-cloud.summary.start-migration">Upload everything</Trans>
            </Button>
          </Box>
        )}

        {resources && <ResourcesTable resources={resources} />}
      </Stack>

      {/* <DisconnectModal isOpen={isDisconnecting} onDismiss={() => setIsDisconnecting(false)} /> */}
    </>
  );
};
