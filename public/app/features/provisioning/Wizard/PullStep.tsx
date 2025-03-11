import { useCallback, useEffect, useState, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { Stack, Text, Alert } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositorySyncMutation } from '../api';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

export interface PullStepProps {
  onStatusChange: (success: boolean) => void;
  onRunningChange: (isRunning: boolean) => void;
}

export function PullStep({ onStatusChange, onRunningChange }: PullStepProps) {
  const [syncRepo, syncQuery] = useCreateRepositorySyncMutation();
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isInitialSync, setIsInitialSync] = useState(true);
  const { watch } = useFormContext<WizardFormData>();

  // Memoize form values to prevent unnecessary re-renders
  const formValues = useMemo(
    () => ({
      repositoryName: watch('repositoryName'),
    }),
    [watch]
  );

  const syncName = syncQuery.data?.metadata?.name;

  // Update running state
  useEffect(() => {
    onRunningChange(showSyncStatus || syncQuery.isLoading);
  }, [showSyncStatus, syncQuery.isLoading, onRunningChange]);

  // Memoize the status change handler
  const handleStatusChange = useCallback(
    (success: boolean) => {
      onStatusChange(success);
    },
    [onStatusChange]
  );

  // Handle initial sync
  useEffect(() => {
    let isMounted = true;

    const startSync = async () => {
      if (!formValues.repositoryName || !isInitialSync) {
        return;
      }

      try {
        const response = await syncRepo({
          name: formValues.repositoryName,
          body: {
            incremental: false,
          },
        }).unwrap();

        if (!isMounted) {
          return;
        }

        if (response?.metadata?.name) {
          setShowSyncStatus(true);
          setSyncError(null);
        } else {
          setShowSyncStatus(false);
          setSyncError('Invalid response from sync operation');
          handleStatusChange(false);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setShowSyncStatus(false);
        setSyncError(error instanceof Error ? error.message : 'Failed to start sync operation');
        handleStatusChange(false);
      } finally {
        if (isMounted) {
          setIsInitialSync(false);
        }
      }
    };

    startSync();

    return () => {
      isMounted = false;
    };
  }, [formValues, syncRepo, handleStatusChange, isInitialSync]);

  return (
    <Stack direction="column" gap={2}>
      <Text color="secondary">
        Pulling all resources from your repository to this Grafana instance. After this initial pull, all future updates
        from the repository will be automatically synchronized.
      </Text>

      {syncError && (
        <Alert severity="error" title="Sync Error">
          {syncError}
        </Alert>
      )}

      <RequestErrorAlert request={syncQuery} />

      {(syncQuery.isLoading || showSyncStatus) && (
        <Text>{syncQuery.isLoading ? 'Initializing sync operation...' : 'Pulling resources from repository...'}</Text>
      )}

      {showSyncStatus && syncName && (
        <JobStatus
          name={syncName}
          onStatusChange={(success) => {
            handleStatusChange(success);
            if (!success) {
              setShowSyncStatus(false);
              setSyncError('Sync operation failed');
            }
          }}
        />
      )}
    </Stack>
  );
}
