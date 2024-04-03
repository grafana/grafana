import { skipToken } from '@reduxjs/toolkit/query/react';
import React, { useCallback, useMemo } from 'react';

import { config } from '@grafana/runtime';
import { Alert, Box, Button, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import {
  MigrateDataResponseDto,
  MigrateDataResponseItemDto,
  useDeleteCloudMigrationMutation,
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
  const lastMigrationRun = useGetLatestMigrationRun(migrationDestination.data?.id);
  const [performRunMigration, runMigrationResult] = useRunCloudMigrationMutation();
  const [performDisconnect, disconnectResult] = useDeleteCloudMigrationMutation();

  // isBusy is not a loading state, but indicates that the system is doing *something*
  // and all buttons should be disabled
  const isBusy =
    runMigrationResult.isLoading ||
    migrationDestination.isFetching ||
    lastMigrationRun.isFetching ||
    disconnectResult.isLoading;

  const resources = useFixResources(lastMigrationRun.data);

  const handleDisconnect = useCallback(() => {
    if (migrationDestination.data?.id) {
      performDisconnect({
        id: migrationDestination.data.id,
      });
    }
  }, [migrationDestination.data?.id, performDisconnect]);

  const handleStartMigration = useCallback(() => {
    if (migrationDestination.data?.id) {
      performRunMigration({ id: migrationDestination.data?.id });
    }
  }, [performRunMigration, migrationDestination]);

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
        {runMigrationResult.isError && (
          <Alert
            severity="error"
            title={t(
              'migrate-to-cloud.summary.run-migration-error-title',
              'There was an error migrating your resources'
            )}
          >
            <Trans i18nKey="migrate-to-cloud.summary.run-migration-error-description">
              See the Grafana server logs for more details
            </Trans>
          </Alert>
        )}

        {disconnectResult.isError && (
          <Alert
            severity="error"
            title={t('migrate-to-cloud.summary.disconnect-error-title', 'There was an error disconnecting')}
          >
            <Trans i18nKey="migrate-to-cloud.summary.disconnect-error-description">
              See the Grafana server logs for more details
            </Trans>
          </Alert>
        )}

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
                  <Button
                    disabled={isBusy}
                    onClick={handleDisconnect}
                    variant="secondary"
                    size="sm"
                    icon={disconnectResult.isLoading ? 'spinner' : undefined}
                  >
                    <Trans i18nKey="migrate-to-cloud.summary.disconnect">Disconnect</Trans>
                  </Button>
                </>
              }
            />

            <Button
              disabled={isBusy}
              onClick={handleStartMigration}
              icon={runMigrationResult.isLoading ? 'spinner' : undefined}
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

// converts API status to our expected/mocked status
function convertStatus(status: string) {
  switch (status) {
    case 'OK':
      return 'migrated';
    case 'ERROR':
      return 'failed';
    case 'failed':
      return 'failed';
    default:
      return 'failed';
  }
}

function useFixResources(data: MigrateDataResponseDto | undefined) {
  return useMemo(() => {
    if (!data?.items) {
      return undefined;
    }

    const betterResources: MigrationResourceDTOMock[] = data.items.flatMap((item) => {
      if (item.type === 'DATASOURCE') {
        const datasourceConfig = Object.values(config.datasources).find((v) => v.uid === item.refId);

        return {
          type: 'datasource',
          uid: item.refId ?? '',
          status: convertStatus(item.status ?? ''),
          statusMessage: item.error,
          resource: {
            uid: item.refId ?? '',
            name: datasourceConfig?.name ?? 'Unknown data source',
            type: datasourceConfig?.meta?.name ?? 'Unknown type',
            icon: datasourceConfig?.meta?.info?.logos?.small,
          },
        };
      }

      if (item.type === 'DASHBOARD') {
        return {
          type: 'dashboard',
          uid: item.refId ?? '',
          status: convertStatus(item.status ?? ''),
          statusMessage: item.error,
          resource: {
            uid: item.refId ?? '',
            name: item.refId ?? 'Unknown dashboard',
          },
        };
      }

      return [];
    });

    return betterResources;
  }, [data]);
}
