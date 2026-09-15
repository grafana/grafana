import { type Control, type FieldValues, type Path, type UseFormRegister, useWatch } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Checkbox, ControlledCollapse, Field, Input, Stack, TextLink } from '@grafana/ui';

import { checkPublicAccess } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';

export interface WebhookSectionProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  control: Control<T>;
  name: Path<T>;
  disabledName: Path<T>;
  connectionWebhookDisabled?: boolean;
  disabledReason?: string;
  disabledError?: string;
}

export function WebhookSection<T extends FieldValues>({
  register,
  control,
  name,
  disabledName,
  connectionWebhookDisabled,
  disabledReason,
  disabledError,
}: WebhookSectionProps<T>) {
  const isPublic = checkPublicAccess();
  const webhookDisabled = Boolean(useWatch({ control, name: disabledName }));
  const forcedDisabled = Boolean(connectionWebhookDisabled) || Boolean(disabledReason);
  const urlDisabled = webhookDisabled || forcedDisabled;

  return (
    <ControlledCollapse label={t('provisioning.webhook-section.label-webhook', 'Webhook options')} isOpen={false}>
      <Stack direction="column" gap={2}>
        <Field noMargin invalid={!!disabledError} error={disabledError}>
          {forcedDisabled ? (
            <Checkbox
              key="forced"
              disabled
              checked
              label={t('provisioning.webhook-section.label-webhook-disabled', 'Disable webhook integration')}
              description={
                connectionWebhookDisabled
                  ? t(
                      'provisioning.webhook-section.description-webhook-disabled-forced',
                      'Webhook integration is disabled because the referenced GitHub App connection has webhook integration disabled.'
                    )
                  : disabledReason
              }
            />
          ) : (
            <Checkbox
              key="user"
              {...register(disabledName)}
              label={t('provisioning.webhook-section.label-webhook-disabled', 'Disable webhook integration')}
              description={t(
                'provisioning.webhook-section.description-webhook-disabled',
                'When checked, Grafana will not register or receive webhook events and will poll the repository on an interval instead. Use this when Grafana is not reachable from the public internet.'
              )}
            />
          )}
        </Field>
        <Field
          noMargin
          label={t('provisioning.webhook-section.label-webhook-url', 'Webhook URL')}
          description={
            <>
              <Trans i18nKey="provisioning.webhook-section.description-webhook-url">
                Overrides the auto-detected URL for registering webhooks.
              </Trans>
              {!isPublic && (
                <>
                  {' '}
                  <TextLink variant="bodySmall" href={GETTING_STARTED_URL}>
                    <Trans i18nKey="provisioning.webhook-section.description-webhook-url-learn-more">Learn more</Trans>
                  </TextLink>
                </>
              )}
            </>
          }
        >
          <Input
            {...register(name)}
            disabled={urlDisabled}
            placeholder={t('provisioning.webhook-section.placeholder-webhook-url', 'https://grafana.example.com')}
          />
        </Field>
      </Stack>
    </ControlledCollapse>
  );
}
