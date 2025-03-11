import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Alert, Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositoryMigrateMutation } from '../api';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

export interface MigrateStepProps {
  onStatusChange: (success: boolean) => void;
  onRunningChange: (isRunning: boolean) => void;
}

export function MigrateStep({ onStatusChange, onRunningChange }: MigrateStepProps) {
  const [migrateRepo, migrateQuery] = useCreateRepositoryMigrateMutation();
  const [showMigrateStatus, setShowMigrateStatus] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [isInitialMigrate, setIsInitialMigrate] = useState(true);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const migrateName = migrateQuery.data?.metadata?.name;
  const identifier = watch('migrate.identifier');
  const history = watch('migrate.history');

  // Update running state
  useEffect(() => {
    onRunningChange(showMigrateStatus || migrateQuery.isLoading);
  }, [showMigrateStatus, migrateQuery.isLoading, onRunningChange]);

  // Handle initial migration
  useEffect(() => {
    let isMounted = true;

    const startMigrate = async () => {
      if (!repositoryName || !isInitialMigrate) {
        return;
      }

      try {
        const response = await migrateRepo({
          name: repositoryName,
          body: {
            identifier,
            history,
          },
        }).unwrap();

        if (!isMounted) {
          return;
        }

        if (response?.metadata?.name) {
          setShowMigrateStatus(true);
          setMigrateError(null);
        } else {
          onStatusChange(false);
          setShowMigrateStatus(false);
          setMigrateError('Invalid response from migration operation');
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        onStatusChange(false);
        setShowMigrateStatus(false);
        setMigrateError(error instanceof Error ? error.message : 'Failed to start migration operation');
      } finally {
        if (isMounted) {
          setIsInitialMigrate(false);
        }
      }
    };

    startMigrate();

    return () => {
      isMounted = false;
    };
  }, [repositoryName, migrateRepo, onStatusChange, identifier, history, isInitialMigrate]);

  return (
    <Stack direction="column" gap={2}>
      <Text color="secondary">
        Migrating all dashboards from this instance to your repository, including their identifiers and complete
        history. After this one-time migration, all future updates will be automatically saved to the repository.
      </Text>

      {!repositoryName && (
        <Alert severity="error" title="Repository name required">
          Repository name is required to migrate dashboards. Please complete the repository configuration step first.
        </Alert>
      )}

      {migrateError && (
        <Alert severity="error" title="Migration Error">
          {migrateError}
        </Alert>
      )}

      <RequestErrorAlert request={migrateQuery} />

      <Alert severity="info" title="Note">
        Dashboards will be unavailable while running this process.
      </Alert>

      {(migrateQuery.isLoading || showMigrateStatus) && (
        <Text>
          {migrateQuery.isLoading ? 'Initializing migration operation...' : 'Migrating dashboards to repository...'}
        </Text>
      )}

      {showMigrateStatus && migrateName && (
        <JobStatus
          name={migrateName}
          onStatusChange={(success) => {
            onStatusChange(success);
            if (!success) {
              setShowMigrateStatus(false);
              setMigrateError('Migration operation failed');
            }
          }}
        />
      )}
    </Stack>
  );
}
