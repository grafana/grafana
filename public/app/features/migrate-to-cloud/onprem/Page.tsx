import { skipToken } from '@reduxjs/toolkit/query/react';
import { useCallback, useEffect, useState } from 'react';

import { config } from '@grafana/runtime';
import { AlertVariant, Box, Stack, Text } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import {
  GetSnapshotResponseDto,
  SnapshotDto,
  useCancelSnapshotMutation,
  useCreateSnapshotMutation,
  useDeleteSessionMutation,
  useGetSessionListQuery,
  useGetShapshotListQuery,
  useGetSnapshotQuery,
  useUploadSnapshotMutation,
  useGetLocalPluginListQuery,
} from '../api';
import { AlertWithTraceID } from '../shared/AlertWithTraceID';

import { DisconnectModal } from './DisconnectModal';
import { EmptyState } from './EmptyState/EmptyState';
import { MigrationSummary } from './MigrationSummary';
import { ResourcesTable } from './ResourcesTable';
import { BuildSnapshotCTA, CreatingSnapshotCTA } from './SnapshotCTAs';
import { SupportedTypesDisclosure } from './SupportedTypesDisclosure';
import { useNotifySuccessful } from './useNotifyOnSuccess';

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

const SNAPSHOT_REBUILD_STATUSES: Array<SnapshotDto['status']> = ['PENDING_UPLOAD', 'FINISHED', 'ERROR', 'UNKNOWN'];
const SNAPSHOT_BUILDING_STATUSES: Array<SnapshotDto['status']> = ['INITIALIZING', 'CREATING'];
const SNAPSHOT_UPLOADING_STATUSES: Array<SnapshotDto['status']> = ['UPLOADING', 'PENDING_PROCESSING', 'PROCESSING'];

const PAGE_SIZE = 50;

function useGetLatestSnapshot(sessionUid?: string, page = 1) {
  const [shouldPoll, setShouldPoll] = useState(false);

  const listResult = useGetShapshotListQuery(
    sessionUid ? { uid: sessionUid, page: 1, limit: 1, sort: 'latest' } : skipToken
  );
  const lastItem = listResult.currentData?.snapshots?.at(0);

  const getSnapshotQueryArgs =
    sessionUid && lastItem?.uid
      ? { uid: sessionUid, snapshotUid: lastItem.uid, resultLimit: PAGE_SIZE, resultPage: page }
      : skipToken;

  const snapshotResult = useGetSnapshotQuery(getSnapshotQueryArgs, {
    pollingInterval: shouldPoll ? config.cloudMigrationPollIntervalMs : 0,
    skipPollingIfUnfocused: true,
  });

  const isError = listResult.isError || snapshotResult.isError;

  useEffect(() => {
    const shouldPoll = !isError && SHOULD_POLL_STATUSES.includes(snapshotResult.data?.status);
    setShouldPoll(shouldPoll);
  }, [snapshotResult?.data?.status, isError]);

  return {
    ...snapshotResult,

    // RTK Query will retain old data if a new request has been skipped.
    // This meant that if you loaded a snapshot, disconnected, and then reconnected, we would
    // show the old snapshot.
    // This ensures that if the query has been skipped (because GetSessionList returned nothing)
    // we don't return stale data
    data: getSnapshotQueryArgs === skipToken ? undefined : snapshotResult.data,

    error: listResult.error || snapshotResult.error,

    // isSuccess and isUninitialised should always be from snapshotResult
    // as only the 'final' values from those are important
    isError,
    isLoading: listResult.isLoading || snapshotResult.isLoading,
    isFetching: listResult.isFetching || snapshotResult.isFetching,
  };
}

export const Page = () => {
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const session = useGetLatestSession();
  const [page, setPage] = useState(1);
  const snapshot = useGetLatestSnapshot(session.data?.uid, page);
  const [performCreateSnapshot, createSnapshotResult] = useCreateSnapshotMutation();
  const [performUploadSnapshot, uploadSnapshotResult] = useUploadSnapshotMutation();
  const [performCancelSnapshot, cancelSnapshotResult] = useCancelSnapshotMutation();
  const [performDisconnect, disconnectResult] = useDeleteSessionMutation();

  const { currentData: localPlugins = [] } = useGetLocalPluginListQuery();

  useNotifySuccessful(snapshot.data);

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

  const showBuildSnapshot = !snapshot.isError && !snapshot.isLoading && !snapshot.data;
  const showBuildingSnapshot = SNAPSHOT_BUILDING_STATUSES.includes(status);
  const showUploadSnapshot =
    !snapshot.isError && (status === 'PENDING_UPLOAD' || SNAPSHOT_UPLOADING_STATUSES.includes(status));
  const showRebuildSnapshot = SNAPSHOT_REBUILD_STATUSES.includes(status);

  const error = getError({
    snapshot: snapshot.data,
    getSnapshotError: snapshot.error,
    getSessionError: session.error,
    createSnapshotError: createSnapshotResult.error,
    uploadSnapshotError: uploadSnapshotResult.error,
    cancelSnapshotError: cancelSnapshotResult.error,
    disconnectSnapshotError: disconnectResult.error,
  });

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
    return (
      <div>
        <Trans i18nKey="migrate-to-cloud.summary.page-loading">Loading...</Trans>
      </div>
    );
  } else if (!session.data) {
    return <EmptyState />;
  }

  return (
    <>
      <Stack direction="column" gap={2}>
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
            showRebuildSnapshot={showRebuildSnapshot}
          />
        )}

        {error && (
          <AlertWithTraceID severity={error.severity} title={error.title} error={error.error}>
            <Text element="p">{error.body}</Text>
          </AlertWithTraceID>
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
          <Stack gap={4} direction="column">
            <ResourcesTable
              resources={snapshot.data.results}
              localPlugins={localPlugins}
              onChangePage={setPage}
              numberOfPages={Math.ceil((snapshot?.data?.stats?.total || 0) / PAGE_SIZE)}
              page={page}
            />
            <SupportedTypesDisclosure />
          </Stack>
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

interface GetErrorProps {
  snapshot: GetSnapshotResponseDto | undefined;
  getSessionError: unknown; // From getLatestSessionQuery
  getSnapshotError: unknown; // From getLatestSnapshotQuery
  createSnapshotError: unknown; // From createSnapshotMutation
  uploadSnapshotError: unknown; // From uploadSnapshotMutation
  cancelSnapshotError: unknown; // From cancelSnapshotMutation
  disconnectSnapshotError: unknown; // From disconnectMutation
}

interface ErrorDescription {
  title: string;
  body: string;
  severity: AlertVariant;
  error?: unknown;
}

function getError(props: GetErrorProps): ErrorDescription | undefined {
  const {
    snapshot,
    getSnapshotError,
    getSessionError,
    createSnapshotError,
    uploadSnapshotError,
    cancelSnapshotError,
    disconnectSnapshotError,
  } = props;

  const seeLogs = t('migrate-to-cloud.onprem.error-see-server-logs', 'See the Grafana server logs for more details');

  if (getSessionError) {
    return {
      severity: 'error',
      title: t('migrate-to-cloud.onprem.get-session-error-title', 'Error loading migration configuration'),
      body: seeLogs,
      error: getSessionError,
    };
  }

  if (getSnapshotError) {
    return {
      severity: 'error',
      title: t('migrate-to-cloud.onprem.get-snapshot-error-title', 'Error loading snapshot'),
      body: seeLogs,
      error: getSnapshotError,
    };
  }

  if (disconnectSnapshotError) {
    return {
      severity: 'warning',
      title: t('migrate-to-cloud.onprem.disconnect-error-title', 'Error disconnecting'),
      body: seeLogs,
      error: disconnectSnapshotError,
    };
  }

  if (createSnapshotError) {
    return {
      severity: 'warning',
      title: t('migrate-to-cloud.onprem.create-snapshot-error-title', 'Error creating snapshot'),
      body: seeLogs,
      error: createSnapshotError,
    };
  }

  if (uploadSnapshotError) {
    return {
      severity: 'warning',
      title: t('migrate-to-cloud.onprem.upload-snapshot-error-title', 'Error uploading snapshot'),
      body: seeLogs,
      error: uploadSnapshotError,
    };
  }

  if (cancelSnapshotError) {
    return {
      severity: 'warning',
      title: t('migrate-to-cloud.onprem.cancel-snapshot-error-title', 'Error cancelling creating snapshot'),
      body: seeLogs,
      error: cancelSnapshotError,
    };
  }

  if (snapshot?.status === 'ERROR') {
    return {
      severity: 'warning',
      title: t('migrate-to-cloud.onprem.snapshot-error-status-title', 'Error migrating resources'),
      body: t(
        'migrate-to-cloud.onprem.snapshot-error-status-body',
        'There was an error creating the snapshot or starting the migration process. See the Grafana server logs for more details'
      ),
    };
  }

  const errorCount = snapshot?.stats?.statuses?.['ERROR'] ?? 0;
  const warningCount = snapshot?.stats?.statuses?.['WARNING'] ?? 0;
  if (snapshot?.status === 'FINISHED' && errorCount + warningCount > 0) {
    let msgBody = '';

    // If there are any errors, that's the most pressing info. If there are no errors but warnings, show the warning text instead.
    if (errorCount > 0) {
      msgBody = t(
        'migrate-to-cloud.onprem.migration-finished-with-errors-body',
        'The migration has completed, but some items could not be migrated to the cloud stack. Check the failed resources for more details'
      );
    } else if (warningCount > 0) {
      msgBody = t(
        'migrate-to-cloud.onprem.migration-finished-with-warnings-body',
        'The migration has completed with some warnings. Check individual resources for more details'
      );
    }

    return {
      severity: 'warning',
      title: t('migrate-to-cloud.onprem.migration-finished-with-caveat-title', 'Resource migration complete'),
      body: msgBody,
    };
  }

  return undefined;
}
