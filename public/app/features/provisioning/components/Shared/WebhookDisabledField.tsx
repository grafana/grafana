import { type UseFormRegisterReturn } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox, Field } from '@grafana/ui';

import { type ConnectionFormData } from '../../types';
import { isOAuthConnectionType } from '../../utils/connectionOAuth';

interface Props {
  type: ConnectionFormData['type'];
  registration: UseFormRegisterReturn;
  invalid?: boolean;
  error?: string;
}

export function WebhookDisabledField({ type, registration, invalid, error }: Props) {
  const description = isOAuthConnectionType(type)
    ? t(
        'provisioning.connection-form.description-webhook-disabled-oauth',
        'When enabled, Grafana will not register or receive webhook events for repositories using this connection. Use this when Grafana is not reachable from the public internet.'
      )
    : t(
        'provisioning.connection-form.description-webhook-disabled',
        'When enabled, the GitHub App does not require webhooks:write permission and Grafana will not register or receive webhook events. Use this when Grafana is not reachable from the public internet.'
      );

  return (
    <Field noMargin invalid={invalid} error={error}>
      <Checkbox
        {...registration}
        label={t('provisioning.connection-form.label-webhook-disabled', 'Disable webhook integration')}
        description={description}
      />
    </Field>
  );
}
