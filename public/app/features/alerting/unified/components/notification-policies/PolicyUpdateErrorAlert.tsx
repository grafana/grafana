import { Alert } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { stringifyErrorLike } from '../../utils/misc';

export const NotificationPoliciesErrorAlert = ({ error }: { error: unknown }) => {
  const title = t('alerting.policies.update-errors.title', 'Error saving notification policy');

  const errMessage = stringifyErrorLike(error);
  return (
    <Alert title={title} severity="error">
      <div>
        <Trans i18nKey="alerting.policies.update-errors.fallback">
          Something went wrong when updating your notification policies.
        </Trans>
      </div>
      <div>
        {errMessage || (
          <Trans i18nKey="alerting.policies.update-errors.error-code" values={{ error }}>
            Error message: "{{ error }}"
          </Trans>
        )}
      </div>

      <Trans i18nKey="alerting.policies.update-errors.suffix">Please refresh the page and try again.</Trans>
    </Alert>
  );
};
