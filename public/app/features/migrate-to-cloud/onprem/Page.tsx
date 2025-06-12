import { skipToken } from '@reduxjs/toolkit/query/react';
import { useCallback, useEffect, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { AlertVariant, Box, Stack, Text } from '@grafana/ui';

import {
  GetSnapshotResponseDto,
  SnapshotDto,
  useCancelSnapshotMutation,
  useCreateSnapshotMutation,
  useDeleteSessionMutation,
  useGetResourceDependenciesQuery,
  useGetSessionListQuery,
  useGetShapshotListQuery,
  useGetSnapshotQuery,
  useUploadSnapshotMutation,
  useGetLocalPluginListQuery,
} from '../api';
import { maybeAPIError } from '../api/errors';
import { AlertWithTraceID } from '../shared/AlertWithTraceID';

import { ConfigureSnapshot } from './ConfigureSnapshot';
import { EmptyState } from './EmptyState/EmptyState';
import { MigrationSummary } from './MigrationSummary';
import { ResourcesTable } from './ResourcesTable';
import { CreatingSnapshotCTA } from './SnapshotCTAs';
import { SupportedTypesDisclosure } from './SupportedTypesDisclosure';
import { ResourceTableItem } from './types';
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

const PAGE_SIZE = 50;

function useGetLatestSnapshot(sessionUid?: string, page = 1, sortParams?: SortParams, showErrors = false) {
  const [shouldPoll, setShouldPoll] = useState(false);

  const listResult = useGetShapshotListQuery(
    sessionUid ? { uid: sessionUid, page: 1, limit: 1, sort: 'latest' } : skipToken
  );
  const lastItem = listResult.currentData?.snapshots?.at(0);

  const getSnapshotQueryArgs =
    sessionUid && lastItem?.uid
      ? {
          uid: sessionUid,
          snapshotUid: lastItem.uid,
          resultLimit: PAGE_SIZE,
          resultPage: page,
          resultSortColumn: sortParams?.column ? sortParams.column : undefined,
          resultSortOrder: sortParams?.order,
          errorsOnly: showErrors,
        }
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

interface SortParams {
  column: string;
  order: string | undefined;
}

export const Page = () => {
  const [page, setPage] = useState(1);
  const [sortParams, setSortParams] = useState<SortParams>({
    column: '',
    order: undefined,
  });
  const [highlightErrors, setHighlightErrors] = useState(false);

  const { data: resourceDependencies = { resourceDependencies: [] } } = useGetResourceDependenciesQuery();
  const [reconfiguring, setReconfiguring] = useState(false);
  const [lastSnapshotUid, setLastSnapshotUid] = useState<string | undefined>(undefined);

  const [performCreateSnapshot, createSnapshotResult] = useCreateSnapshotMutation();
  const [performUploadSnapshot, uploadSnapshotResult] = useUploadSnapshotMutation();
  const [performCancelSnapshot, cancelSnapshotResult] = useCancelSnapshotMutation();
  const [performDisconnect, disconnectResult] = useDeleteSessionMutation();

  const { currentData: localPlugins = [] } = useGetLocalPluginListQuery();

  const session = useGetLatestSession();
  const snapshot = useGetLatestSnapshot(session.data?.uid, page, sortParams, highlightErrors);
  const numPages = Math.ceil(
    (highlightErrors ? snapshot?.data?.stats?.statuses?.['ERROR'] || 0 : snapshot?.data?.stats?.total || 0) / PAGE_SIZE
  );
  useEffect(() => {
    if (numPages > 0 && page > numPages) {
      setPage(numPages);
    }
  }, [numPages, page]);

  const [uiState, setUiState] = useState<'loading' | 'configure' | 'building' | 'built' | 'uploading' | 'uploaded'>(
    'loading'
  );

  useNotifySuccessful(snapshot.data);

  const sessionUid = session.data?.uid;
  const snapshotUid = snapshot.data?.uid;
  const snapshotStatus = snapshot.data?.status;

  // isBusy is not a loading state, but indicates that the system is doing *something* and all buttons should be disabled.
  const isBusy =
    createSnapshotResult.isLoading ||
    uploadSnapshotResult.isLoading ||
    cancelSnapshotResult.isLoading ||
    session.isLoading ||
    snapshot.isLoading ||
    disconnectResult.isLoading;

  // Because we don't delete the previous snapshot if it exists, we need to keep track of the last snapshot.
  // When reconfiguring a snapshot, we need to pause the state machine until a new snapshot is created.
  // Reconfiguration is triggered by the user clicking the "Reconfigure snapshot" button at the end of the migration.
  useEffect(() => {
    if (
      reconfiguring &&
      lastSnapshotUid !== snapshot.data?.uid &&
      createSnapshotResult.isSuccess &&
      createSnapshotResult.data?.uid
    ) {
      setLastSnapshotUid(createSnapshotResult.data.uid);
      setReconfiguring(false);
    }
  }, [
    createSnapshotResult.isSuccess,
    createSnapshotResult.data?.uid,
    lastSnapshotUid,
    snapshot.data?.uid,
    setLastSnapshotUid,
    setReconfiguring,
    reconfiguring,
  ]);

  // UI State Machine
  useEffect(() => {
    // If we don't have a session or the snapshot is still loading, don't do anything yet!
    if (!sessionUid || snapshot.isLoading || snapshot.isFetching) {
      return;
    }

    // When loading the page for the first time, we might already have a snapshot in a workable state.
    if (uiState === 'loading') {
      // Snapshot is being created.
      if (snapshotStatus === 'CREATING') {
        setUiState('building');
        return;
      }

      // Ready to upload.
      if (snapshotStatus === 'PENDING_UPLOAD') {
        setUiState('built');
        return;
      }

      // Snapshot is uploaded but still being processed by the backend.
      if (['UPLOADING', 'PENDING_PROCESSING', 'PROCESSING'].includes(snapshotStatus ?? '')) {
        setUiState('uploading');
        return;
      }

      // Already uploaded with results, can reupload or reconfigure.
      if (snapshotStatus === 'FINISHED') {
        setUiState('uploaded');
        return;
      }

      // Either the snapshot does not exist or is in an error state. In either case, we need to reconfigure.
      if (!snapshotStatus || snapshotStatus === 'ERROR') {
        setUiState('configure');
        return;
      }
    }

    // When the snapshot is being created, go to the building (spinner) state.
    if (uiState === 'configure' && snapshotStatus === 'CREATING') {
      setUiState('building');
      return;
    }

    // When the snapshot has finished building, go to the built state (ready to upload + resource table "not yet uploaded").
    // If we are reconfiguring, we pause the state machine until the new snapshot is actually set to PENDING_UPLOAD.
    // That in turn will cause `reconfiguring` to be set to `false` which will resume the state machine.
    if (!reconfiguring && uiState === 'building' && snapshotStatus === 'PENDING_UPLOAD') {
      setUiState('built');
      return;
    }

    // When the snapshot is being uploaded, go to the uploading state (spinner + resource table "in progress").
    if (uiState === 'built' && (snapshotStatus === 'PROCESSING' || snapshotStatus === 'UPLOADING')) {
      setUiState('uploading');
      return;
    }

    // When the snapshot has finished uploading, go to the uploaded state (resource table "success/error").
    if (uiState === 'uploading' && snapshotStatus === 'FINISHED') {
      setUiState('uploaded');
      return;
    }

    // Special case: if there's nothing to choose in the snapshot, go back to reconfiguring.
    if (
      !reconfiguring &&
      (uiState === 'built' || uiState === 'uploaded') &&
      snapshotStatus !== 'FINISHED' &&
      (snapshot.data?.results?.length === 0 || snapshot.isUninitialized)
    ) {
      setReconfiguring(true);
      setUiState('configure');
      return;
    }

    // Error handling: if we are building a snapshot and there's an error, go back to the configure state.
    // Also display the error in the UI.
    if (uiState === 'building' && (createSnapshotResult.error || snapshot.isError)) {
      setUiState('configure');
      return;
    }

    // Error handling: if we are uploading a snapshot and there's an error, force move to the uploaded state.
    // Also display the error in the UI, so the user can reconfigure it.
    if (uiState === 'uploading' && (uploadSnapshotResult.error || snapshotStatus === 'ERROR')) {
      setUiState('uploaded');
      return;
    }
  }, [
    sessionUid,
    snapshotStatus,
    snapshot.isLoading,
    snapshot.isFetching,
    snapshot.isUninitialized,
    snapshot.isError,
    setReconfiguring,
    setUiState,
    uiState,
    reconfiguring,
    snapshot.data?.results?.length,
    createSnapshotResult.error,
    uploadSnapshotResult.error,
  ]);

  const error = getError({
    snapshot: snapshot.data,
    getSnapshotError: snapshot.error,
    getSessionError: session.error,
    createSnapshotError: createSnapshotResult.error,
    uploadSnapshotError: uploadSnapshotResult.error,
    cancelSnapshotError: cancelSnapshotResult.error,
    disconnectSnapshotError: disconnectResult.error,
  });

  // Action Callbacks
  const handleCreateSnapshot = useCallback(
    (resourceTypes: Array<ResourceTableItem['type']>) => {
      if (sessionUid) {
        setUiState('building');

        performCreateSnapshot({
          uid: sessionUid,
          createSnapshotRequestDto: {
            resourceTypes,
          },
        });
      }
    },
    [performCreateSnapshot, sessionUid]
  );

  const handleUploadSnapshot = useCallback(() => {
    if (sessionUid && snapshotUid) {
      performUploadSnapshot({ uid: sessionUid, snapshotUid: snapshotUid });
    }
  }, [performUploadSnapshot, sessionUid, snapshotUid]);

  const handleRebuildSnapshot = useCallback(() => {
    if (sessionUid && snapshotUid) {
      setReconfiguring(true);
      setUiState('configure');
    }
  }, [setUiState, setReconfiguring, sessionUid, snapshotUid]);

  const handleCancelSnapshot = useCallback(() => {
    if (sessionUid && snapshotUid) {
      setUiState('configure');

      performCancelSnapshot({ uid: sessionUid, snapshotUid: snapshotUid });
    }
  }, [performCancelSnapshot, setUiState, sessionUid, snapshotUid]);

  const handleDisconnect = useCallback(async () => {
    if (sessionUid) {
      setUiState('loading');

      performDisconnect({ uid: sessionUid });
    }
  }, [performDisconnect, setUiState, sessionUid]);

  // Component Rendering
  if (session.isLoading) {
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
        <MigrationSummary
          session={session.data}
          snapshot={snapshot.data}
          isBusy={isBusy}
          disconnectIsLoading={disconnectResult.isLoading}
          onDisconnect={handleDisconnect}
          showUploadSnapshot={['built', 'uploading'].includes(uiState)}
          uploadSnapshotIsLoading={uploadSnapshotResult.isLoading || uiState === 'uploading'}
          onUploadSnapshot={handleUploadSnapshot}
          showRebuildSnapshot={['built', 'uploading', 'uploaded'].includes(uiState)}
          onRebuildSnapshot={handleRebuildSnapshot}
          onHighlightErrors={() => setHighlightErrors(!highlightErrors)}
          isHighlightErrors={highlightErrors}
          showOnlyErrorsSwitch={['uploading', 'uploaded'].includes(uiState)}
        />

        {(['built', 'uploaded'].includes(uiState) || !!createSnapshotResult?.error) && error && (
          <AlertWithTraceID severity={error.severity} title={error.title} error={error.error}>
            <Text element="p">{error.body}</Text>
          </AlertWithTraceID>
        )}

        {uiState === 'configure' && (
          <ConfigureSnapshot
            disabled={isBusy}
            isLoading={isBusy}
            onClick={handleCreateSnapshot}
            resourceDependencies={resourceDependencies.resourceDependencies || []}
          />
        )}

        {uiState === 'building' && (
          <Box display="flex" justifyContent="center" paddingY={10}>
            <CreatingSnapshotCTA
              disabled={isBusy}
              isLoading={cancelSnapshotResult.isLoading}
              onClick={handleCancelSnapshot}
            />
          </Box>
        )}

        {['built', 'uploading', 'uploaded'].includes(uiState) &&
          snapshot.data?.results &&
          snapshot.data?.results.length > 0 && (
            <Stack gap={4} direction="column">
              <ResourcesTable
                resources={snapshot.data.results}
                localPlugins={localPlugins}
                onChangePage={setPage}
                numberOfPages={numPages}
                page={page}
                onChangeSort={(a) => {
                  const order = a.sortBy[0]?.desc === undefined ? undefined : a.sortBy[0]?.desc ? 'desc' : 'asc';
                  if (sortParams.column !== a.sortBy[0]?.id || order !== sortParams.order) {
                    setSortParams({
                      column: a.sortBy[0]?.id,
                      order: order,
                    });
                  }
                }}
              />
              <SupportedTypesDisclosure />
            </Stack>
          )}
      </Stack>
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
    return handleCreateSnapshotError(createSnapshotError, seeLogs);
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
        'The migration has completed, but some items could not be migrated to the cloud stack. Check the failed resources for more details.'
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

function handleCreateSnapshotError(createSnapshotError: unknown, seeLogs: string): ErrorDescription | undefined {
  const apiError = maybeAPIError(createSnapshotError);

  let severity: AlertVariant = 'warning';
  let body = null;

  switch (apiError?.messageId) {
    case 'cloudmigrations.emptyResourceTypes':
      severity = 'error';
      body = t(
        'migrate-to-cloud.onprem.create-snapshot-error-empty-resource-types',
        'You need to provide at least one resource type for snapshot creation'
      );
      break;

    case 'cloudmigrations.unknownResourceType':
      severity = 'error';
      body = t(
        'migrate-to-cloud.onprem.create-snapshot-error-unknown-resource-type',
        'Unknown resource type. See the Grafana server logs for more details'
      );
      break;

    case 'cloudmigrations.duplicateResourceType':
      severity = 'error';
      body = t(
        'migrate-to-cloud.onprem.create-snapshot-error-duplicate-resource-type',
        'Duplicate resource type. See the Grafana server logs for more details'
      );
      break;

    case 'cloudmigrations.missingDependency':
      severity = 'error';
      body = t(
        'migrate-to-cloud.onprem.create-snapshot-error-missing-dependency',
        'Missing dependency. See the Grafana server logs for more details'
      );
      break;
  }

  return {
    severity,
    title: t('migrate-to-cloud.onprem.create-snapshot-error-title', 'Error creating snapshot'),
    body: body || seeLogs,
    error: createSnapshotError,
  };
}
