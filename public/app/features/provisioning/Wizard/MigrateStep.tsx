import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';

import { Alert, Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositoryMigrateMutation } from '../api';

import { WizardFormData } from './types';

export interface MigrateStepProps {
  onStatusChange: (success: boolean) => void;
  onRunningChange: (isRunning: boolean) => void;
  onErrorChange: (error: string | null) => void;
}

export function MigrateStep({ onStatusChange, onRunningChange, onErrorChange }: MigrateStepProps) {
  const [migrateRepo, migrateQuery] = useCreateRepositoryMigrateMutation();
  const hasInitialized = useRef(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const identifier = watch('migrate.identifier');
  const history = watch('migrate.history');
  const migrateName = migrateQuery.data?.metadata?.name;

  useEffect(() => {
    // Early return conditions
    if (!repositoryName || hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    let isMounted = true;

    const handleError = (error: unknown) => {
      if (!isMounted) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to start migration operation';
      onErrorChange(errorMessage);
      onStatusChange(false);
      onRunningChange(false);
    };

    const startMigrate = async () => {
      try {
        onRunningChange(true);
        const response = await migrateRepo({
          name: repositoryName,
          body: { identifier, history },
        }).unwrap();

        if (!isMounted) {
          return;
        }

        if (!response?.metadata?.name) {
          handleError(new Error('Invalid response from migration operation'));
        }
      } catch (error) {
        handleError(error);
      }
    };

    startMigrate();
    return () => {
      isMounted = false;
    };
  }, [repositoryName, migrateRepo, onStatusChange, onErrorChange, onRunningChange, identifier, history]);

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
          onStatusChange={onStatusChange}
          onRunningChange={onRunningChange}
          onErrorChange={onErrorChange}
        />
      )}
    </Stack>
  );
}
