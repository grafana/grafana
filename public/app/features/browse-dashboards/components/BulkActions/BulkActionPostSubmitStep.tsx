import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

import { BulkActionFailureBanner, MoveResultFailed } from './BulkActionFailureBanner';
import { BulkActionProgress, ProgressState } from './BulkActionProgress';
import { MoveResultSuccessState } from './utils';

// TODO: DELETE
interface Props {
  action: 'move' | 'delete';
  progress: ProgressState | null;
  successState: MoveResultSuccessState;
  failureResults: MoveResultFailed[] | undefined;
  handleSuccess: () => void;
  setFailureResults: (results: MoveResultFailed[] | undefined) => void;
}

export function BulkActionPostSubmitStep({
  action,
  progress,
  successState,
  failureResults,
  handleSuccess,
  setFailureResults,
}: Props) {
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
