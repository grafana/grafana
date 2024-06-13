import { skipToken } from '@reduxjs/toolkit/query/react';
import React, { useCallback, useState } from 'react';

import { Alert, Box, Button, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import {
  useDeleteSessionMutation,
  useGetCloudMigrationRunListQuery,
  useGetCloudMigrationRunQuery,
  useGetSessionListQuery,
  useRunCloudMigrationMutation,
} from '../api';

import { DisconnectModal } from './DisconnectModal';
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
  const result = useGetSessionListQuery();
  const latestMigration = result.data?.sessions?.at(-1);

  return {
    ...result,
    data: latestMigration,
  };
}

function useGetLatestMigrationRun(migrationUid?: string) {
  const listResult = useGetCloudMigrationRunListQuery(migrationUid ? { uid: migrationUid } : skipToken);
  const latestMigrationRun = listResult.data?.runs?.at(-1);

  const runResult = useGetCloudMigrationRunQuery(
    latestMigrationRun?.uid && migrationUid ? { runUid: latestMigrationRun.uid } : skipToken
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
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const migrationDestination = useGetLatestMigrationDestination();
  const lastMigrationRun = useGetLatestMigrationRun(migrationDestination.data?.uid);
  const [performRunMigration, runMigrationResult] = useRunCloudMigrationMutation();
  const [performDisconnect, disconnectResult] = useDeleteSessionMutation();

  // isBusy is not a loading state, but indicates that the system is doing *something*
  // and all buttons should be disabled
  const isBusy =
    runMigrationResult.isLoading ||
    migrationDestination.isFetching ||
    lastMigrationRun.isFetching ||
    disconnectResult.isLoading;

  const resources = lastMigrationRun.data?.items;
  const migrationDestUID = migrationDestination.data?.uid;

  const handleDisconnect = useCallback(async () => {
    if (!migrationDestUID) {
      return;
    }

    const resp = await performDisconnect({ uid: migrationDestUID });
    if (!('error' in resp)) {
      setDisconnectModalOpen(false);
    }
  }, [migrationDestUID, performDisconnect]);

  const handleStartMigration = useCallback(() => {
    if (migrationDestination.data?.uid) {
      performRunMigration({ uid: migrationDestination.data?.uid });
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

        {migrationMeta.slug && (
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
                  {migrationMeta.slug}{' '}
                  <Button
                    disabled={isBusy}
                    onClick={() => setDisconnectModalOpen(true)}
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

      <DisconnectModal
        isOpen={disconnectModalOpen}
        isLoading={disconnectResult.isLoading}
        isError={disconnectResult.isError}
        onDisconnectConfirm={handleDisconnect}
        onDismiss={() => setDisconnectModalOpen(false)}
      />
    </>
  );
};
