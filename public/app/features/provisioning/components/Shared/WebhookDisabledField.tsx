import { type UseFormRegisterReturn } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, Field } from '@grafana/ui';

interface Props {
  registration: UseFormRegisterReturn;
  invalid?: boolean;
  error?: string;
}

export function WebhookDisabledField({ registration, invalid, error }: Props) {
  return (
    <Field noMargin invalid={invalid} error={error}>
      <Checkbox
        {...registration}
        label={t('provisioning.connection-form.label-webhook-disabled', 'Disable webhook integration')}
        description={t(
          'provisioning.connection-form.description-webhook-disabled',
          'When enabled, the GitHub App does not require webhooks:write permission and Grafana will not register or receive webhook events. Use this when Grafana is not reachable from the public internet.'
        )}
      />
    </Field>
  );
}
