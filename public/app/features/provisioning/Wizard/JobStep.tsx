import { ReactNode, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useAsync } from 'react-use';

import { Stack, Text } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning';
import { t } from 'app/core/internationalization';

import { JobStatus } from '../Job/JobStatus';
import { StepStatus, useStepStatus } from '../hooks/useStepStatus';

import { WizardFormData } from './types';

interface JobStepProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
  description: ReactNode;
  startJob: (repositoryName: string) => Promise<Job>;
  children?: ReactNode;
}

export type { JobStepProps };

export function JobStep({ onStepUpdate, description, startJob, children }: JobStepProps) {
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const stepStatus = useStepStatus({ onStepUpdate });
  const [job, setJob] = useState<Job>();

  // Set initial running state outside the async operation
  useAsync(async () => {
    // Skip if we don't have a repository name or if we already started the job
    if (!repositoryName || job) {
      return;
    }

    // Only set running state when we're actually going to start the job
    stepStatus.setRunning();

    try {
      const response = await startJob(repositoryName);
      if (!response?.metadata?.name) {
        throw new Error(t('provisioning.job-step.error-invalid-response', 'Invalid response from operation'));
      }
      setJob(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('provisioning.job-step.error-failed-to-start', 'Failed to start operation');
      stepStatus.setError(errorMessage);
      throw error; // Re-throw to mark the async operation as failed
    }
  }, [repositoryName, job, setJob]); // Only depend on values that determine if we should start the job

  return (
    <Stack direction="column" gap={2}>
      {description && <Text color="secondary">{description}</Text>}
      {children}

      {job && (
        <JobStatus
          watch={job}
          onStatusChange={(success) => {
            if (success) {
              stepStatus.setSuccess();
            } else {
              stepStatus.setError(t('provisioning.job-step.error-job-failed', 'Job failed'));
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
