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
  // Keep a finished status so the longer retry path re-emitting it does not flip the alert in a
  // render loop. An error is not kept: the watcher reports a failed job lookup the same way as a
  // failed job, and the lookup can recover into a finished job.
  const [status, setStatus] = useState<StepStatusInfo>();

  const onStatusChange = useCallback((info: StepStatusInfo) => {
    if (['error', 'warning', 'success'].includes(info.status)) {
      setStatus((prev) => {
        // A job that finished is final; nothing can follow it.
        const finished = prev?.status === 'success' || prev?.status === 'warning';
        return finished || prev?.status === info.status ? prev : info;
      });
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
