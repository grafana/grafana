import { Job } from 'app/api/clients/provisioning';

import { JobContent } from './JobContent';
import { useJobStatusEffect } from './hooks';

export interface ActiveJobProps {
  job: Job;
  onStatusChange?: (success: boolean) => void;
  onRunningChange?: (isRunning: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function ActiveJobStatus({ job, onStatusChange, onRunningChange, onErrorChange }: ActiveJobProps) {
  useJobStatusEffect(job, onStatusChange, onRunningChange, onErrorChange);
  return <JobContent job={job} isFinishedJob={false} />;
}
