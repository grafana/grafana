import { ReactNode } from 'react';

import { useCreateRepositorySyncMutation } from '../api';
import { StepStatus } from '../hooks/useStepStatus';

import { JobStep } from './JobStep';

interface PullStepProps {
  onStepUpdate: (status: StepStatus, error?: string) => void;
  description?: ReactNode;
}

export function PullStep({ onStepUpdate, description }: PullStepProps) {
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
      description={description || 'Pulling repository content...'}
      startJob={startSync}
    />
  );
}
