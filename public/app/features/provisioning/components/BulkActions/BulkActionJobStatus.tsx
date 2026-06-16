import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { type Job } from 'app/api/clients/provisioning/v0alpha1';
import { JobStatus } from 'app/features/provisioning/Job/JobStatus';

import { ProvisioningAlert } from '../../Shared/ProvisioningAlert';
import { type StepStatusInfo } from '../../Wizard/types';
import { type JobType } from '../../types';

interface BulkActionJobStatusProps {
  job: Job;
  jobType: JobType;
  // Success wording when the job committed directly to the configured branch.
  committedTitle: string;
  // The job was submitted via the branch workflow, so its changes went to a branch.
  pushedToBranch: boolean;
}

export function BulkActionJobStatus({ job, jobType, committedTitle, pushedToBranch }: BulkActionJobStatusProps) {
  // Keep the first terminal status so the longer retry path re-emitting the same
  // status does not flip the alert back and forth in a render loop.
  const [status, setStatus] = useState<StepStatusInfo>();

  const onStatusChange = useCallback((info: StepStatusInfo) => {
    if (info.status === 'error' || info.status === 'warning' || info.status === 'success') {
      setStatus((prev) => prev ?? info);
    }
  }, []);

  const successTitle = pushedToBranch
    ? t('provisioning.bulk-action.success-title-branch', 'Requested changes were pushed to a branch')
    : committedTitle;

  return (
    <>
      <ProvisioningAlert
        error={status?.status === 'error' ? status.error : undefined}
        warning={status?.status === 'warning' ? status.warning : undefined}
        success={status?.status === 'success' ? { title: successTitle } : undefined}
      />
      <JobStatus watch={job} jobType={jobType} onStatusChange={onStatusChange} />
    </>
  );
}
