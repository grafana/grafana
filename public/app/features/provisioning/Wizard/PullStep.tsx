import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Alert, Button, FieldSet, Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositorySyncMutation } from '../api';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

export interface PullStepProps {
  onStatusChange: (success: boolean) => void;
}

export function PullStep({ onStatusChange }: PullStepProps) {
  const [syncRepo, syncQuery] = useCreateRepositorySyncMutation();
  const [showSyncStatus, setShowSyncStatus] = useState(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const syncName = syncQuery.data?.metadata?.name;

  const handleSync = async () => {
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

  if (showSyncStatus && syncName) {
    return (
      <Stack direction="column" gap={2}>
        <JobStatus name={syncName} onStatusChange={onStatusChange} />
      </Stack>
    );
  }

  return (
    <FieldSet label="3. Pull resources">
      <Stack direction="column" gap={2}>
        <Text color="secondary">
          Pull all resources from your repository to this Grafana instance. After this initial pull, all future updates
          from the repository will be automatically synchronized.
        </Text>

        {!repositoryName && (
          <Alert severity="error" title="Repository name required">
            Repository name is required to pull resources. Please complete the repository configuration step first.
          </Alert>
        )}
        <RequestErrorAlert request={syncQuery} />

        <Stack alignItems="flex-start">
          <Button
            onClick={handleSync}
            disabled={syncQuery.isLoading || !repositoryName}
            icon={syncQuery.isLoading ? 'spinner' : undefined}
          >
            {syncQuery.isLoading ? 'Pulling...' : 'Start pull'}
          </Button>
        </Stack>
      </Stack>
    </FieldSet>
  );
}
