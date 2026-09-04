import { lazy, Suspense } from 'react';

import { Trans } from '@grafana/i18n';
import { Spinner, Stack, Text } from '@grafana/ui';
import { type Job } from 'app/api/clients/provisioning/v0alpha1';

import { type StepStatusInfo } from '../Wizard/types';
import { type JobType } from '../types';

export interface JobStatusProps {
  watch: Job;
  jobType: JobType;
  onStatusChange?: (statusInfo: StepStatusInfo) => void;
  onRetry?: () => void;
}

// The job UI (JobContent, JobSummary, FinishedJobStatus) pulls InteractiveTable and with
// it react-table into every consumer, including the provisioned-dashboard banners on the
// dashboard view path. Jobs only render after a user action starts one, so the
// implementation is loaded on demand.
const JobStatusInner = lazy(() =>
  import(/* webpackChunkName: "provisioning-job-status" */ './JobStatusInner').then((m) => ({
    default: m.JobStatusInner,
  }))
);

export function JobStatus(props: JobStatusProps) {
  return (
    <Suspense
      fallback={
        <Stack direction="row" alignItems="center" justifyContent="center" gap={2}>
          <Spinner size={24} />
          <Text element="h4" color="secondary">
            <Trans i18nKey="provisioning.job-status.starting">Starting...</Trans>
          </Text>
        </Stack>
      }
    >
      <JobStatusInner {...props} />
    </Suspense>
  );
}
