import { skipToken } from '@reduxjs/toolkit/query/react';
import { useCallback, useState } from 'react';

import { Alert, Box, Button, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import {
  SnapshotDto,
  useCreateSnapshotMutation,
  useDeleteSessionMutation,
  useGetSessionListQuery,
  useGetShapshotListQuery,
  useGetSnapshotQuery,
  useRunCloudMigrationMutation,
  useUploadSnapshotMutation,
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

function useGetLatestSession() {
  const result = useGetSessionListQuery();
  const latestMigration = result.data?.sessions?.at(-1);

  return {
    ...result,
    data: latestMigration,
  };
}

const SHOULD_POLL_STATUSES: Array<SnapshotDto['status']> = [
  'INITIALIZING',
  'CREATING',
  'PENDING_UPLOAD',
  'UPLOADING',
  'PENDING_PROCESSING',
  'PROCESSING',
];

const STATUS_POLL_INTERVAL = 5 * 1000;

function useGetLatestSnapshot(sessionUid?: string) {
  const listResult = useGetShapshotListQuery(sessionUid ? { uid: sessionUid } : skipToken);
  const lastItem = listResult.data?.snapshots?.at(-1); // TODO: account for pagination and ensure we're truely getting the last one

  const getSnapshotQueryArgs = sessionUid && lastItem?.uid ? { uid: sessionUid, snapshotUid: lastItem.uid } : skipToken;

  const snapshot = useGetSnapshotQuery(getSnapshotQueryArgs, {
    pollingInterval: SHOULD_POLL_STATUSES.includes(lastItem?.status) ? STATUS_POLL_INTERVAL : undefined,
    skipPollingIfUnfocused: true,
  });

  return {
    ...snapshot,

    data: snapshot.data,

    error: listResult.error || snapshot.error,

    isError: listResult.isError || snapshot.isError,
    isLoading: listResult.isLoading || snapshot.isLoading,
    isFetching: listResult.isFetching || snapshot.isFetching,
  };
}

export const Page = () => {
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const session = useGetLatestSession();
  const snapshot = useGetLatestSnapshot(session.data?.uid);
  const [performCreateSnapshot, createSnapshotResult] = useCreateSnapshotMutation();
  const [performUploadSnapshot, uploadSnapshotResult] = useUploadSnapshotMutation();
  const [performDisconnect, disconnectResult] = useDeleteSessionMutation();

  console.log('session', session);
  console.log('snapshot', snapshot);

  const sessionUid = session.data?.uid;
  const snapshotUid = snapshot.data?.uid;

  // isBusy is not a loading state, but indicates that the system is doing *something*
  // and all buttons should be disabled
  const isBusy =
    createSnapshotResult.isLoading ||
    uploadSnapshotResult.isLoading ||
    session.isFetching ||
    snapshot.isFetching ||
    disconnectResult.isLoading;

  const resources = snapshot.data?.results;

  const handleDisconnect = useCallback(async () => {
    window.alert('TODO: Implement handleDisconnect');
  }, []);

  const handleCreateSnapshot = useCallback(() => {
    if (sessionUid) {
      performCreateSnapshot({ uid: sessionUid });
    }
  }, [performCreateSnapshot, sessionUid]);

  const handleUploadSnapshot = useCallback(() => {
    if (sessionUid && snapshotUid) {
      performUploadSnapshot({ uid: sessionUid, snapshotUid: snapshotUid });
    }
  }, [performUploadSnapshot, sessionUid, snapshotUid]);

  const migrationMeta = session.data;
  const isInitialLoading = session.isLoading;

  if (isInitialLoading) {
    // TODO: better loading state
    return <div>Loading...</div>;
  } else if (!migrationMeta) {
    return <EmptyState />;
  }

  return (
    <>
      <Stack direction="column" gap={4}>
        {createSnapshotResult.isError && (
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
              onClick={handleCreateSnapshot}
              icon={createSnapshotResult.isLoading ? 'spinner' : undefined}
            >
              <Trans i18nKey="migrate-to-cloud.summary.start-migration">Build snapshot</Trans>
            </Button>

            <Button
              disabled={isBusy}
              onClick={handleUploadSnapshot}
              icon={createSnapshotResult.isLoading ? 'spinner' : undefined}
            >
              <Trans i18nKey="migrate-to-cloud.summary.upload-migration">Upload snapshot</Trans>
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
