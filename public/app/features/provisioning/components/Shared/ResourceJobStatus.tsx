import { useCallback, useEffect, useRef, useState } from 'react';

import { type Job } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../../Job/JobStatus';
import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { type JobSuccess, type StepStatusInfo } from '../../Wizard/types';
import { type JobType } from '../../types';

interface ResourceJobStatusProps {
  job: Job;
  jobType: JobType;
  /** Title of the success alert. Omit when `onSuccess` leaves the page instead. */
  successTitle?: string;
  /** Runs once, on the first success status, with the finished job's branch and PR links. */
  onSuccess?: (info: JobSuccess) => void;
}

/**
 * Watches a delete/move job and owns the outcome: error and warning alerts stay in place of the
 * blank the watcher leaves when its lookup fails, and success either shows an alert or hands off.
 */
export function ResourceJobStatus({ job, jobType, successTitle, onSuccess }: ResourceJobStatusProps) {
  const [status, setStatus] = useState<StepStatusInfo>();

  const onStatusChange = useCallback((info: StepStatusInfo) => {
    if (['error', 'warning', 'success'].includes(info.status)) {
      // A finished job is final. Anything earlier, including a failed job lookup the watcher reports
      // as an error, is superseded by whatever it reports next.
      setStatus((prev) => (prev?.status === 'success' || prev?.status === 'warning' ? prev : info));
    }
  }, []);

  const notified = useRef(false);
  useEffect(() => {
    if (status?.status === 'success' && !notified.current) {
      notified.current = true;
      onSuccess?.(status);
    }
  }, [status, onSuccess]);

  return (
    <>
      <ProvisioningAlert
        error={status?.status === 'error' ? status.error : undefined}
        warning={status?.status === 'warning' ? status.warning : undefined}
        success={status?.status === 'success' && successTitle ? { title: successTitle } : undefined}
      />
      <JobStatus watch={job} jobType={jobType} onStatusChange={onStatusChange} />
    </>
  );
}
