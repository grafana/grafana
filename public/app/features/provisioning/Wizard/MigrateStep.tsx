import { useCallback, useEffect, useState, useRef } from 'react';
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
  const hasInitialized = useRef(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const identifier = watch('migrate.identifier');
  const history = watch('migrate.history');
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
    if (!repositoryName || hasInitialized.current) {
      return;
    }

    let isMounted = true;
    hasInitialized.current = true;

    const startMigrate = async () => {
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
      }
    };

    startMigrate();

    return () => {
      isMounted = false;
    };
  }, [repositoryName, migrateRepo, handleStatusChange, identifier, history]);

  // Show job status when we have a job name
  useEffect(() => {
    if (migrateName) {
      setShowMigrateStatus(true);
    }
  }, [migrateName]);

  const handleJobStatusChange = useCallback(
    (success: boolean) => {
      if (success) {
        setShowMigrateStatus(false);
        setMigrateError(null);
        onRunningChange(false);
        handleStatusChange(true);
      } else {
        setShowMigrateStatus(false);
        setMigrateError('Migration operation failed');
        onRunningChange(false);
        handleStatusChange(false);
      }
    },
    [handleStatusChange, onRunningChange]
  );

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

      {migrateQuery.isLoading && <Text>Initializing migration operation...</Text>}

      {migrateName && <JobStatus name={migrateName} onStatusChange={handleJobStatusChange} />}
    </Stack>
  );
}
