import { useCreateRepositorySyncMutation } from 'app/api/clients/provisioning';
import { t } from 'app/core/internationalization';

import { StepStatus } from '../hooks/useStepStatus';

import { JobStep } from './JobStep';

interface PullStepProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
}

export function PullStep({ onStepUpdate }: PullStepProps) {
  const [syncRepo] = useCreateRepositorySyncMutation();

  const startSync = async (repositoryName: string) => {
    const response = await syncRepo({
      name: repositoryName,
      body: { incremental: false },
    }).unwrap();
    return response;
  };

  return (
    <JobStep
      onStepUpdate={onStepUpdate}
      description={t(
        'provisioning.pull-step.description-pulling-content',
        'Pulling all content from your repository to this Grafana instance. This ensures your dashboards and other resources are synchronized with the repository.'
      )}
      startJob={startSync}
    />
  );
}
