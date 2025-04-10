import { useEffect } from 'react';

import { Job } from 'app/api/clients/provisioning';
import { t } from 'app/core/internationalization';

// Shared hook for status change effects
export function useJobStatusEffect(
  job?: Job,
  onStatusChange?: (success: boolean) => void,
  onRunningChange?: (isRunning: boolean) => void,
  onErrorChange?: (error: string | null) => void
) {
  useEffect(() => {
    if (!job) {
      return;
    }

    if (onStatusChange && job.status?.state === 'success') {
      onStatusChange(true);
      if (onRunningChange) {
        onRunningChange(false);
      }
    }
    if (onErrorChange && job.status?.state === 'error') {
      onErrorChange(job.status.message ?? t('provisioning.job-status.error-unknown', 'An unknown error occurred'));
      if (onRunningChange) {
        onRunningChange(false);
      }
    }
  }, [job, onStatusChange, onErrorChange, onRunningChange]);
}
