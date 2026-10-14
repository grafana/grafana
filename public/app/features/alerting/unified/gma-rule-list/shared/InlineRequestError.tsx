import { Trans } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

import { stringifyErrorLike } from '../../utils/misc';

interface InlineRequestErrorProps {
  title: string;
  error?: unknown;
  onRetry: () => void;
}

/**
 * Error shown in place of the content that failed to load, next to whatever already loaded, so a
 * failed request never hides data and never reads as an empty result.
 */
export function InlineRequestError({ title, error, onRetry }: InlineRequestErrorProps) {
  return (
    <Alert severity="error" title={title}>
      <Stack direction="column" gap={1} alignItems="flex-start">
        {error !== undefined && <div>{stringifyErrorLike(error)}</div>}
        <Button size="sm" variant="secondary" icon="sync" onClick={onRetry}>
          <Trans i18nKey="alerting.gma-rule-list.shared.retry">Retry</Trans>
        </Button>
      </Stack>
    </Alert>
  );
}
