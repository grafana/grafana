import { skipToken } from '@reduxjs/toolkit/query';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Box, Spinner, Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useListJobQuery } from '../api';
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
  const hasInitialized = useRef(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const stepStatus = useStepStatus({ onStepUpdate });
  const [jobName, setJobName] = useState<string>();

  // Query the job status if we have a job name
  const jobQuery = useListJobQuery(jobName ? { watch: true, fieldSelector: `metadata.name=${jobName}` } : skipToken);

  useEffect(() => {
    if (!repositoryName || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    let isMounted = true;

    const executeJob = async () => {
      try {
        if (!isMounted) {
          return;
        }

        stepStatus.setRunning();
        const response = await startJob(repositoryName);

        if (!response?.metadata?.name) {
          stepStatus.setError('Invalid response from operation');
          return;
        }
        setJobName(response.metadata.name);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        stepStatus.setError(error instanceof Error ? error.message : 'Failed to start operation');
      }
    };

    executeJob();
    return () => {
      isMounted = false;
    };
  }, [repositoryName, startJob, stepStatus]);

  const job = jobQuery.data?.items?.[0];
  const showSpinner = !job;

  return (
    <Stack direction="column" gap={2}>
      {description && <Text color="secondary">{description}</Text>}
      {children}

      <Box>
        {showSpinner && (
          <Stack direction="row" alignItems="center" gap={2}>
            <Spinner size={24} />
            <Text element="h4" weight="bold">
              Starting...
            </Text>
          </Stack>
        )}

        {job && (
          <JobStatus
            name={jobName!}
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
      </Box>
    </Stack>
  );
}
