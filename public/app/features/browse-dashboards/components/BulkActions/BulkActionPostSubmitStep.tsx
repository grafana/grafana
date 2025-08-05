import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { Job } from 'app/api/clients/provisioning/v0alpha1';

import { BulkActionJobStatus } from './BulkActionJobStatus';

import { BulkActionFailureBanner, MoveResultFailed } from './BulkActionFailureBanner';
import { BulkActionProgress, ProgressState } from './BulkActionProgress';
import { MoveResultSuccessState } from './utils';

interface Props {
  action: 'move' | 'delete';
  progress: ProgressState | null;
  successState: MoveResultSuccessState;
  failureResults: MoveResultFailed[] | undefined;
  handleSuccess: () => void;
  setFailureResults: (results: MoveResultFailed[] | undefined) => void;
  // Optional job support - when provided, shows JobStatus instead of manual progress
  job?: Job;
  onDismiss?: () => void;
  // Callback for job completion
  onJobComplete?: (jobState: string, isSuccess: boolean) => void;
}

export function BulkActionPostSubmitStep({
  action,
  progress,
  successState,
  failureResults,
  handleSuccess,
  setFailureResults,
  job,
  onDismiss,
  onJobComplete,
}: Props) {
  // Handle job errors
  const handleJobError = (error: string) => {
    setFailureResults([
      {
        status: 'failed',
        title: 'Bulk Delete Job Failed',
        errorMessage: error,
      },
    ]);
  };

  // If job is provided, show BulkActionJobStatus with dismiss button
  if (job) {
    return (
      <Stack direction="column" gap={2}>
        <BulkActionJobStatus 
          watch={job} 
          onJobComplete={onJobComplete}
          onJobError={handleJobError}
        />
        {onDismiss && (
          <Stack gap={2}>
            <Button variant="secondary" fill="outline" onClick={onDismiss}>
              <Trans i18nKey="browse-dashboards.bulk-action-resources-form.button-close">Close</Trans>
            </Button>
          </Stack>
        )}
      </Stack>
    );
  }

  if (progress) {
    return <BulkActionProgress progress={progress} action={action} />;
  }

  if (successState.allSuccess) {
    return (
      <>
        <Alert severity="success" title={t('browse-dashboards.bulk-action-resources-form.progress-title', 'Success')}>
          {action === 'move'
            ? t('browse-dashboards.bulk-action-resources-form.all-moved', 'All resources have been moved successfully')
            : t(
                'browse-dashboards.bulk-action-resources-form.all-deleted',
                'All resources have been deleted successfully'
              )}
        </Alert>
        <Stack gap={2}>
          <Button onClick={() => handleSuccess()}>
            <Trans i18nKey="browse-dashboards.bulk-action-resources-form.button-done">Done</Trans>
          </Button>
        </Stack>
      </>
    );
  }

  if (failureResults) {
    return <BulkActionFailureBanner result={failureResults} onDismiss={() => setFailureResults(undefined)} />;
  }

  return null;
}
