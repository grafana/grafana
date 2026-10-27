import { Trans } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

import { stringifyErrorLike } from '../../utils/misc';

interface InlineRequestErrorProps {
  title: string;
  error?: unknown;
  onRetry: () => void;
}

/** Shown beside loaded data, so a failure never hides data or reads as empty. */
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
