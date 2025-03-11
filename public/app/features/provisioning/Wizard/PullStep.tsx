import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

import { Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositorySyncMutation } from '../api';
import { StepStatus, useStepStatus } from '../hooks/useStepStatus';

import { WizardFormData } from './types';

export interface PullStepProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
}

export function PullStep({ onStepUpdate }: PullStepProps) {
  const [syncRepo, syncQuery] = useCreateRepositorySyncMutation();
  const hasInitialized = useRef(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const syncName = syncQuery.data?.metadata?.name;

  const stepStatus = useStepStatus({ onStepUpdate });

  useEffect(() => {
    if (!repositoryName || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    let isMounted = true;

    const startSync = async () => {
      try {
        stepStatus.setRunning();
        const response = await syncRepo({
          name: repositoryName,
          body: { incremental: false },
        }).unwrap();

        if (!isMounted) {
          return;
        }

        if (!response?.metadata?.name) {
          stepStatus.setError('Invalid response from sync operation');
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        stepStatus.setError(error instanceof Error ? error.message : 'Failed to start sync operation');
      }
    };

    startSync();
    return () => {
      isMounted = false;
    };
  }, [repositoryName, syncRepo, stepStatus]);

  return (
    <Stack direction="column" gap={2}>
      <Text color="secondary">
        Pulling all resources from your repository to this Grafana instance. After this initial pull, all future updates
        from the repository will be automatically synchronized.
      </Text>
      {syncName && (
        <JobStatus
          name={syncName}
          onStatusChange={(success) => (success ? stepStatus.setSuccess() : stepStatus.setError('Job failed'))}
          onRunningChange={(isRunning) => isRunning && stepStatus.setRunning()}
          onErrorChange={(error) => error && stepStatus.setError(error)}
        />
      )}
    </Stack>
  );
}
