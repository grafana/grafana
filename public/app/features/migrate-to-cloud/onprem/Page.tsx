import { skipToken } from '@reduxjs/toolkit/query/react';
import { useCallback, useEffect, useState } from 'react';

import { Alert, Box, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import {
  SnapshotDto,
  useCancelSnapshotMutation,
  useCreateSnapshotMutation,
  useDeleteSessionMutation,
  useGetSessionListQuery,
  useGetShapshotListQuery,
  useGetSnapshotQuery,
  useUploadSnapshotMutation,
} from '../api';

import { DisconnectModal } from './DisconnectModal';
import { EmptyState } from './EmptyState/EmptyState';
import { MigrationSummary } from './MigrationSummary';
import { ResourcesTable } from './ResourcesTable';
import { BuildSnapshotCTA, CreatingSnapshotCTA } from './SnapshotCTAs';

/**
 * Here's how migrations work:
 *
 * A single on-prem instance can be configured to be migrated to multiple cloud instances. We call these 'sessions'.
 *  - GetSessionList returns this the list of migration targets for the on prem instance
 *  - If GetMigrationList returns an empty list, then an empty state to prompt for token should be shown
 *  - The UI (at the moment) only shows the most recently created migration target (the last one returned from the API)
 *    and doesn't allow for others to be created
 *
 * A single on-prem migration 'target' (CloudMigrationSession) can have multiple snapshots.
 * A snapshot represents a copy of all migratable resources at a fixed point in time.
 * A snapshots are created asynchronously in the background, so GetSnapshot must be polled to get the current status.
 *
 * After a snapshot has been created, it will be PENDING_UPLOAD. UploadSnapshot is then called which asynchronously
 * uploads and migrates the snapshot to the cloud instance.
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
  'UPLOADING',
  'PENDING_PROCESSING',
  'PROCESSING',
];

const SNAPSHOT_BUILDING_STATUSES: Array<SnapshotDto['status']> = ['INITIALIZING', 'CREATING'];

const SNAPSHOT_UPLOADING_STATUSES: Array<SnapshotDto['status']> = ['UPLOADING', 'PENDING_PROCESSING', 'PROCESSING'];

const STATUS_POLL_INTERVAL = 5 * 1000;

function useGetLatestSnapshot(sessionUid?: string) {
  const [shouldPoll, setShouldPoll] = useState(false);

  const listResult = useGetShapshotListQuery(sessionUid ? { uid: sessionUid } : skipToken);
  const lastItem = listResult.data?.snapshots?.at(-1); // TODO: account for pagination and ensure we're truely getting the last one

  const getSnapshotQueryArgs = sessionUid && lastItem?.uid ? { uid: sessionUid, snapshotUid: lastItem.uid } : skipToken;

  const snapshotResult = useGetSnapshotQuery(getSnapshotQueryArgs, {
    pollingInterval: shouldPoll ? STATUS_POLL_INTERVAL : 0,
    skipPollingIfUnfocused: true,
  });

  useEffect(() => {
    const shouldPoll = SHOULD_POLL_STATUSES.includes(snapshotResult.data?.status);
    setShouldPoll(shouldPoll);
  }, [snapshotResult?.data?.status]);

  return {
    ...snapshotResult,

    error: listResult.error || snapshotResult.error,

    // isSuccess and isUninitialised should always be from snapshotResult
    // as only the 'final' values from those are important
    isError: listResult.isError || snapshotResult.isError,
    isLoading: listResult.isLoading || snapshotResult.isLoading,
    isFetching: listResult.isFetching || snapshotResult.isFetching,
  };
}

export const Page = () => {
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const session = useGetLatestSession();
  const snapshot = useGetLatestSnapshot(session.data?.uid);
  const [performCreateSnapshot, createSnapshotResult] = useCreateSnapshotMutation();
  const [performUploadSnapshot, uploadSnapshotResult] = useUploadSnapshotMutation();
  const [performCancelSnapshot, cancelSnapshotResult] = useCancelSnapshotMutation();
  const [performDisconnect, disconnectResult] = useDeleteSessionMutation();

  const sessionUid = session.data?.uid;
  const snapshotUid = snapshot.data?.uid;
  const isInitialLoading = session.isLoading;
  const status = snapshot.data?.status;

  // isBusy is not a loading state, but indicates that the system is doing *something*
  // and all buttons should be disabled
  const isBusy =
    createSnapshotResult.isLoading ||
    uploadSnapshotResult.isLoading ||
    cancelSnapshotResult.isLoading ||
    session.isLoading ||
    snapshot.isLoading ||
    disconnectResult.isLoading;

  const showBuildSnapshot = !snapshot.isLoading && !snapshot.data;
  const showBuildingSnapshot = SNAPSHOT_BUILDING_STATUSES.includes(status);
  const showUploadSnapshot = status === 'PENDING_UPLOAD' || SNAPSHOT_UPLOADING_STATUSES.includes(status);

  const handleDisconnect = useCallback(async () => {
    if (sessionUid) {
      performDisconnect({ uid: sessionUid });
    }
  }, [performDisconnect, sessionUid]);

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

  const handleCancelSnapshot = useCallback(() => {
    if (sessionUid && snapshotUid) {
      performCancelSnapshot({ uid: sessionUid, snapshotUid: snapshotUid });
    }
  }, [performCancelSnapshot, sessionUid, snapshotUid]);

  if (isInitialLoading) {
    // TODO: better loading state
    return <div>Loading...</div>;
  } else if (!session.data) {
    return <EmptyState />;
  }

  return (
    <>
      <Stack direction="column" gap={4}>
        {/* TODO: show errors from all mutation's in a... modal? */}
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

        {session.data && (
          <MigrationSummary
            session={session.data}
            snapshot={snapshot.data}
            isBusy={isBusy}
            disconnectIsLoading={disconnectResult.isLoading}
            onDisconnect={handleDisconnect}
            showBuildSnapshot={showBuildSnapshot}
            buildSnapshotIsLoading={createSnapshotResult.isLoading}
            onBuildSnapshot={handleCreateSnapshot}
            showUploadSnapshot={showUploadSnapshot}
            uploadSnapshotIsLoading={uploadSnapshotResult.isLoading || SNAPSHOT_UPLOADING_STATUSES.includes(status)}
            onUploadSnapshot={handleUploadSnapshot}
          />
        )}

        {(showBuildSnapshot || showBuildingSnapshot) && (
          <Box display="flex" justifyContent="center" paddingY={10}>
            {showBuildSnapshot && (
              <BuildSnapshotCTA
                disabled={isBusy}
                isLoading={createSnapshotResult.isLoading}
                onClick={handleCreateSnapshot}
              />
            )}

            {showBuildingSnapshot && (
              <CreatingSnapshotCTA
                disabled={isBusy}
                isLoading={cancelSnapshotResult.isLoading}
                onClick={handleCancelSnapshot}
              />
            )}
          </Box>
        )}

        {snapshot.data?.results && snapshot.data.results.length > 0 && (
          <ResourcesTable resources={snapshot.data.results} />
        )}
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
