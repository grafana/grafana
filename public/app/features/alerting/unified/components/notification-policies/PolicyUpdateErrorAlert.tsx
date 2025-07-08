import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { stringifyErrorLike } from '../../utils/misc';

export const NotificationPoliciesErrorAlert = ({ error }: { error: unknown }) => {
  const title = t('alerting.policies.update-errors.title', 'Failed to add or update notification policy');

  const errMessage = stringifyErrorLike(error);
  return (
    <Alert title={title} severity="error">
      <div>{errMessage}</div>

      <Trans i18nKey="alerting.policies.update-errors.suffix">Please refresh the page and try again.</Trans>
    </Alert>
  );
};
