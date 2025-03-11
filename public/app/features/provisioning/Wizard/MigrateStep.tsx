import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Alert, Stack, Text } from '@grafana/ui';

import { JobStatus } from '../JobStatus';
import { useCreateRepositoryMigrateMutation } from '../api';

import { RequestErrorAlert } from './RequestErrorAlert';
import { WizardFormData } from './types';

export interface MigrateStepProps {
  onStatusChange: (success: boolean) => void;
}

export function MigrateStep({ onStatusChange }: MigrateStepProps) {
  const [migrateRepo, migrateQuery] = useCreateRepositoryMigrateMutation();
  const [showMigrateStatus, setShowMigrateStatus] = useState(false);
  const { watch } = useFormContext<WizardFormData>();
  const repositoryName = watch('repositoryName');
  const migrateName = migrateQuery.data?.metadata?.name;
  const identifier = watch('migrate.identifier');
  const history = watch('migrate.history');

  useEffect(() => {
    const startMigrate = async () => {
      if (!repositoryName) {
        return;
      }
      setShowMigrateStatus(true);
      const response = await migrateRepo({
        name: repositoryName,
        body: {
          identifier,
          history,
        },
      });
      if ('error' in response) {
        onStatusChange(false);
        setShowMigrateStatus(false);
      }
    };

    startMigrate();
  }, [repositoryName, migrateRepo, onStatusChange, identifier, history]);

  if (showMigrateStatus && migrateName) {
    return (
      <Stack direction="column" gap={2}>
        <JobStatus name={migrateName} onStatusChange={onStatusChange} />
      </Stack>
    );
  }

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
      <RequestErrorAlert request={migrateQuery} />

      <Alert severity="info" title="Note">
        Dashboards will be unavailable while running this process.
      </Alert>

      {migrateQuery.isLoading && <Text>Migrating dashboards to repository...</Text>}
    </Stack>
  );
}
