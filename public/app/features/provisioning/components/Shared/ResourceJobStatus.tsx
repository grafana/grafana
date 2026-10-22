import { useCallback, useEffect, useRef, useState } from 'react';

import { type Job } from 'app/api/clients/provisioning/v0alpha1';

import { JobStatus } from '../../Job/JobStatus';
import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { type StepStatusInfo } from '../../Wizard/types';
import { type JobType } from '../../types';

export type JobSuccess = Extract<StepStatusInfo, { status: 'success' }>;

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
  // Keep the first terminal status so the longer retry path re-emitting the same
  // status does not flip the alert back and forth in a render loop.
  const [status, setStatus] = useState<StepStatusInfo>();

  const onStatusChange = useCallback((info: StepStatusInfo) => {
    if (['error', 'warning', 'success'].includes(info.status)) {
      setStatus((prev) => prev ?? info);
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
