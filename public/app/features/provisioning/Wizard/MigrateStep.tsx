import { useCallback, useEffect, useState, useMemo } from 'react';
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

  // Memoize form values to prevent unnecessary re-renders
  const formValues = useMemo(
    () => ({
      repositoryName: watch('repositoryName'),
      identifier: watch('migrate.identifier'),
      history: watch('migrate.history'),
    }),
    [watch]
  );

  const migrateName = migrateQuery.data?.metadata?.name;

  // Update running state
  useEffect(() => {
    onRunningChange(showMigrateStatus || migrateQuery.isLoading);
  }, [showMigrateStatus, migrateQuery.isLoading, onRunningChange]);

  // Memoize the status change handler
  const handleStatusChange = useCallback(
    (success: boolean) => {
      onStatusChange(success);
    },
    [onStatusChange]
  );

  // Handle initial migration
  useEffect(() => {
    let isMounted = true;

    const startMigrate = async () => {
      if (!formValues.repositoryName || !isInitialMigrate) {
        return;
      }

      try {
        const response = await migrateRepo({
          name: formValues.repositoryName,
          body: {
            identifier: formValues.identifier,
            history: formValues.history,
          },
        }).unwrap();

        if (!isMounted) {
          return;
        }

        if (response?.metadata?.name) {
          setShowMigrateStatus(true);
          setMigrateError(null);
        } else {
          setShowMigrateStatus(false);
          setMigrateError('Invalid response from migration operation');
          handleStatusChange(false);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setShowMigrateStatus(false);
        setMigrateError(error instanceof Error ? error.message : 'Failed to start migration operation');
        handleStatusChange(false);
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
  }, [formValues, migrateRepo, handleStatusChange, isInitialMigrate]);

  return (
    <Stack direction="column" gap={2}>
      <Text color="secondary">
        Migrating all dashboards from this instance to your repository, including their identifiers and complete
        history. After this one-time migration, all future updates will be automatically saved to the repository.
      </Text>

      {!formValues.repositoryName && (
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
            handleStatusChange(success);
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
