import { useCallback, useState } from 'react';

import { type Job } from 'app/api/clients/provisioning/v0alpha1';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { type StepStatusInfo } from '../../Wizard/types';
import { type JobType, type StatusInfo } from '../../types';

interface BulkActionJobStatusProps {
  job: Job;
  jobType: JobType;
  // Stable string (from t(...)); the caller decides the wording per workflow.
  successTitle: string;
}

export function BulkActionJobStatus({ job, jobType, successTitle }: BulkActionJobStatusProps) {
  const [jobError, setJobError] = useState<string | StatusInfo>();
  const [jobWarning, setJobWarning] = useState<string | StatusInfo>();
  const [jobSuccess, setJobSuccess] = useState<string | StatusInfo>();

  const onStatusChange = useCallback(
    (statusInfo: StepStatusInfo) => {
      // Keep the first terminal value so the longer retry path re-emitting the same
      // status does not flip the alert back and forth in a render loop.
      if (statusInfo.status === 'error' && statusInfo.error) {
        const { error } = statusInfo;
        setJobError((prev) => prev ?? error);
      } else if (statusInfo.status === 'warning') {
        const { warning } = statusInfo;
        setJobWarning((prev) => prev ?? warning);
      } else if (statusInfo.status === 'success') {
        setJobSuccess((prev) => prev ?? { title: successTitle });
      }
    },
    [successTitle]
  );

  return (
    <>
      <ProvisioningAlert error={jobError} warning={jobWarning} success={jobSuccess} />
      <JobStatus watch={job} jobType={jobType} onStatusChange={onStatusChange} />
    </>
  );
}
