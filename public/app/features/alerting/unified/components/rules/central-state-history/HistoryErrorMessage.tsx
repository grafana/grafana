import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { stringifyErrorLike } from '../../../utils/misc';

export interface HistoryErrorMessageProps {
  error: unknown;
}

export function HistoryErrorMessage({ error }: HistoryErrorMessageProps) {
  if (isFetchError(error) && error.status === 404) {
    return <EntityNotFound entity="History" />;
  }
  const title = t('alerting.central-alert-history.error', 'Something went wrong loading the alert state history');
  const errorStr = stringifyErrorLike(error);

  return <Alert title={title}>{errorStr}</Alert>;
}
