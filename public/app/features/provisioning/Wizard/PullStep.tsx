import { useCallback, useEffect, useState, useRef } from 'react';
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
  const hasInitialized = useRef(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const syncName = syncQuery.data?.metadata?.name;

  // Update running state
  useEffect(() => {
    const isRunning = showSyncStatus || syncQuery.isLoading;
    onRunningChange(isRunning);
    // If we're not running anymore and there's no error, it means we succeeded
    if (!isRunning && !syncError && syncName) {
      onStatusChange(true);
    }
  }, [showSyncStatus, syncQuery.isLoading, onRunningChange, syncError, syncName, onStatusChange]);

  // Handle initial sync
  useEffect(() => {
    if (!repositoryName || hasInitialized.current) {
      return;
    }

    let isMounted = true;
    hasInitialized.current = true;

    const startSync = async () => {
      try {
        const response = await syncRepo({
          name: repositoryName,
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
          onStatusChange(false);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setShowSyncStatus(false);
        setSyncError(error instanceof Error ? error.message : 'Failed to start sync operation');
        onStatusChange(false);
      }
    };

    startSync();

    return () => {
      isMounted = false;
    };
  }, [repositoryName, syncRepo, onStatusChange]);

  // Show job status when we have a job name
  useEffect(() => {
    if (syncName) {
      setShowSyncStatus(true);
    }
  }, [syncName]);

  const handleJobStatusChange = useCallback(
    (success: boolean) => {
      if (success) {
        setShowSyncStatus(false);
        setSyncError(null);
        onRunningChange(false);
        onStatusChange(true);
      } else {
        setShowSyncStatus(false);
        setSyncError('Sync operation failed');
        onRunningChange(false);
        onStatusChange(false);
      }
    },
    [onStatusChange, onRunningChange]
  );

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

      {syncQuery.isLoading && <Text>Initializing sync operation...</Text>}

      {syncName && <JobStatus name={syncName} onStatusChange={handleJobStatusChange} />}
    </Stack>
  );
}
