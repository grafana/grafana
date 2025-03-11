import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

import { Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositorySyncMutation } from '../api';

import { WizardFormData } from './types';

export interface PullStepProps {
  onStatusChange: (success: boolean) => void;
  onRunningChange: (isRunning: boolean) => void;
  onErrorChange: (error: string | null) => void;
}

export function PullStep({ onStatusChange, onRunningChange, onErrorChange }: PullStepProps) {
  const [syncRepo, syncQuery] = useCreateRepositorySyncMutation();
  const hasInitialized = useRef(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const syncName = syncQuery.data?.metadata?.name;

  // Handle initial sync
  useEffect(() => {
    if (!repositoryName || hasInitialized.current) {
      return;
    }

    let isMounted = true;
    hasInitialized.current = true;

    const startSync = async () => {
      try {
        if (!isMounted) {
          return;
        }

        onRunningChange(true);
        const response = await syncRepo({
          name: repositoryName,
          body: {
            incremental: false,
          },
        }).unwrap();

        if (response?.metadata?.name) {
        } else {
          onErrorChange('Invalid response from sync operation');
          onStatusChange(false);
          onRunningChange(false);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        onErrorChange(error instanceof Error ? error.message : 'Failed to start sync operation');
        onStatusChange(false);
        onRunningChange(false);
      }
    };

    startSync();

    return () => {
      isMounted = false;
    };
  }, [repositoryName, syncRepo, onStatusChange, onErrorChange, onRunningChange]);

  return (
    <Stack direction="column" gap={2}>
      <Text color="secondary">
        Pulling all resources from your repository to this Grafana instance. After this initial pull, all future updates
        from the repository will be automatically synchronized.
      </Text>
      {syncName && (
        <JobStatus
          name={syncName}
          onStatusChange={onStatusChange}
          onRunningChange={onRunningChange}
          onErrorChange={onErrorChange}
        />
      )}
    </Stack>
  );
}
