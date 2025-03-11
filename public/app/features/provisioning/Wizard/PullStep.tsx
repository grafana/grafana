import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Stack, Text } from '@grafana/ui';

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
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const syncName = syncQuery.data?.metadata?.name;

  // Update running state
  useEffect(() => {
    onRunningChange(showSyncStatus);
  }, [showSyncStatus, onRunningChange]);

  useEffect(() => {
    const startSync = async () => {
      if (!repositoryName) {
        return;
      }
      setShowSyncStatus(true);
      const response = await syncRepo({
        name: repositoryName,
        body: {
          incremental: false,
        },
      });
      if ('error' in response) {
        onStatusChange(false);
        setShowSyncStatus(false);
      }
    };

    startSync();
  }, [repositoryName, syncRepo, onStatusChange]);

  if (showSyncStatus && syncName) {
    return (
      <Stack direction="column" gap={2}>
        <JobStatus
          name={syncName}
          onStatusChange={(success) => {
            onStatusChange(success);
            if (!success) {
              setShowSyncStatus(false);
            }
          }}
        />
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      <Text color="secondary">
        Pulling all resources from your repository to this Grafana instance. After this initial pull, all future updates
        from the repository will be automatically synchronized.
      </Text>
      <RequestErrorAlert request={syncQuery} />
      {syncQuery.isLoading && <Text>Pulling resources from repository...</Text>}
    </Stack>
  );
}
