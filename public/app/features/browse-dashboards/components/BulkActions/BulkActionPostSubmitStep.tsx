import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

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
          {t(
            'browse-dashboards.bulk-action-resources-form.repository-url',
            'All resources have been {{ action }} successfully',
            { action: action === 'move' ? 'moved' : 'deleted' }
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
