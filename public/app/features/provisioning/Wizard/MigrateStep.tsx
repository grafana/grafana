import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

import { Alert, Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositoryMigrateMutation } from '../api';
import { StepStatus, useStepStatus } from '../hooks/useStepStatus';

import { WizardFormData } from './types';

export interface MigrateStepProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
}

export function MigrateStep({ onStepUpdate }: MigrateStepProps) {
  const [migrateRepo, migrateQuery] = useCreateRepositoryMigrateMutation();
  const hasInitialized = useRef(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const identifier = watch('migrate.identifier');
  const history = watch('migrate.history');
  const migrateName = migrateQuery.data?.metadata?.name;

  const stepStatus = useStepStatus({ onStepUpdate });

  useEffect(() => {
    if (!repositoryName || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    let isMounted = true;

    const startMigrate = async () => {
      try {
        stepStatus.setRunning();
        const response = await migrateRepo({
          name: repositoryName,
          body: { identifier, history },
        }).unwrap();

        if (!isMounted) {
          return;
        }

        if (!response?.metadata?.name) {
          stepStatus.setError('Invalid response from migration operation');
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        stepStatus.setError(error instanceof Error ? error.message : 'Failed to start migration operation');
      }
    };

    startMigrate();
    return () => {
      isMounted = false;
    };
  }, [repositoryName, migrateRepo, stepStatus, identifier, history]);

  return (
    <Stack direction="column" gap={2}>
      <Text color="secondary">
        Migrating all dashboards from this instance to your repository, including their identifiers and complete
        history. After this one-time migration, all future updates will be automatically saved to the repository.
      </Text>

      <Alert severity="info" title="Note">
        Dashboards will be unavailable while running this process.
      </Alert>

      {migrateName && (
        <JobStatus
          name={migrateName}
          onStatusChange={(success) => (success ? stepStatus.setSuccess() : stepStatus.setError('Job failed'))}
          onRunningChange={(isRunning) => isRunning && stepStatus.setRunning()}
          onErrorChange={(error) => error && stepStatus.setError(error)}
        />
      )}
    </Stack>
  );
}
