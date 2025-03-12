import { ReactNode, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useAsync } from 'react-use';

import { Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { StepStatus, useStepStatus } from '../hooks/useStepStatus';

import { WizardFormData } from './types';

interface JobStepProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
  description: ReactNode;
  startJob: (repositoryName: string) => Promise<{ metadata?: { name?: string } }>;
  children?: ReactNode;
}

export type { JobStepProps };

export function JobStep({ onStepUpdate, description, startJob, children }: JobStepProps) {
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const stepStatus = useStepStatus({ onStepUpdate });
  const [jobName, setJobName] = useState<string>();

  useAsync(async () => {
    if (!repositoryName) {
      return;
    }

    try {
      stepStatus.setRunning();
      const response = await startJob(repositoryName);

      if (!response?.metadata?.name) {
        stepStatus.setError('Invalid response from operation');
        throw new Error('Invalid response from operation');
      }

      setJobName(response.metadata.name);
    } catch (error) {
      stepStatus.setError(error instanceof Error ? error.message : 'Failed to start operation');
      throw error; // Re-throw to mark the async operation as failed
    }
  }, [repositoryName, startJob, stepStatus]);

  return (
    <Stack direction="column" gap={2}>
      {description && <Text color="secondary">{description}</Text>}
      {children}

      {jobName && (
        <JobStatus
          name={jobName}
          onStatusChange={(success) => {
            if (success) {
              stepStatus.setSuccess();
            } else {
              stepStatus.setError('Job failed');
            }
          }}
          onRunningChange={(isRunning) => {
            if (isRunning) {
              stepStatus.setRunning();
            }
          }}
          onErrorChange={(error) => {
            if (error) {
              stepStatus.setError(error);
            }
          }}
        />
      )}
    </Stack>
  );
}
