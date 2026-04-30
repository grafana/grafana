import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { getMessageFromError } from 'app/core/utils/errors';

import { stringifyErrorLike } from '../../../utils/misc';

export interface HistoryErrorMessageProps {
  error: unknown;
}

// Known substrings in the error message that indicate the Loki query itself failed due to
// being too expensive (context canceled by Grafana after timeout, or Loki returning a non-200
// because the gRPC response exceeded its max message size).
const LOKI_QUERY_OVERLOAD_PATTERNS = ['context canceled', 'received a non-200 response from loki'];

function isLokiQueryOverloadError(error: unknown): boolean {
  if (!isFetchError(error) || error.status !== 500) {
    return false;
  }
  const message = getMessageFromError(error).toLowerCase();
  return LOKI_QUERY_OVERLOAD_PATTERNS.some((pattern) => message.includes(pattern));
}

export function HistoryErrorMessage({ error }: HistoryErrorMessageProps) {
  if (isFetchError(error) && error.status === 404) {
    return <EntityNotFound entity="History" />;
  }

  if (isLokiQueryOverloadError(error)) {
    return (
      <Alert
        title={t(
          'alerting.central-alert-history.error.server-error',
          'The alert state history query failed — the server returned an error'
        )}
        severity="error"
      >
        <Trans i18nKey="alerting.central-alert-history.error.server-error.description">
          This can happen when a regex or negation label filter matches too many alert instances and the response
          exceeds the server&apos;s size limit. Try using a shorter time range or a more specific filter (e.g. an exact
          match instead of a regex).
        </Trans>
      </Alert>
    );
  }

  const title = t('alerting.central-alert-history.error', 'Something went wrong loading the alert state history');
  const errorStr = stringifyErrorLike(error);

  return <Alert title={title}>{errorStr}</Alert>;
}
