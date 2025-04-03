import { useFormContext } from 'react-hook-form';

import { useCreateRepositoryJobsMutation } from 'app/api/clients/provisioning';
import { t } from 'app/core/internationalization';

import { StepStatus } from '../hooks/useStepStatus';

import { JobStep } from './JobStep';
import { WizardFormData } from './types';

export interface MigrateStepProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
}

export function MigrateStep({ onStepUpdate }: MigrateStepProps) {
  const [createJob] = useCreateRepositoryJobsMutation();
  const { watch } = useFormContext<WizardFormData>();
  const history = watch('migrate.history');

  const startMigration = async (repositoryName: string) => {
    const response = await createJob({
      name: repositoryName,
      jobSpec: {
        migrate: {
          history,
        },
      },
    }).unwrap();

    return response;
  };

  return (
    <JobStep
      onStepUpdate={onStepUpdate}
      description={t(
        'provisioning.migrate-step.description-migrating-dashboards',
        'Migrating all dashboards from this instance to your repository, including their identifiers and complete history. After this one-time migration, all future updates will be automatically saved to the repository.'
      )}
      startJob={startMigration}
    />
  );
}
