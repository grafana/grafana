import { Alert } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

type SupportedErrors = 'alerting.notifications.conflict' | string;

export const ERROR_NEWER_CONFIGURATION = 'alerting.notifications.conflict';

export const NotificationPoliciesErrorAlert = ({ error }: { error: SupportedErrors }) => {
  const errorMessageMap: Record<SupportedErrors, string> = {
    [ERROR_NEWER_CONFIGURATION]: t(
      'alerting.policies.update-errors.conflict',
      'The notification policy tree has been updated by another user.'
    ),
  };

  const title = t('alerting.policies.update-errors.title', 'Error saving notification policy');

  const errMessage = errorMessageMap[error];
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
