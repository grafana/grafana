import { type FieldValues, type Path, type UseFormRegister } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Checkbox, ControlledCollapse, Field, Input, Stack, TextLink } from '@grafana/ui';

import { checkPublicAccess } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';

export interface WebhookSectionProps<T extends FieldValues> {
  register: UseFormRegister<T>;
  name: Path<T>;
  disabledName: Path<T>;
}

export function WebhookSection<T extends FieldValues>({ register, name, disabledName }: WebhookSectionProps<T>) {
  const isPublic = checkPublicAccess();

  return (
    <ControlledCollapse label={t('provisioning.webhook-section.label-webhook', 'Webhook options')} isOpen={false}>
      <Stack direction="column" gap={2}>
        <Field noMargin>
          <Checkbox
            {...register(disabledName)}
            label={t('provisioning.webhook-section.label-webhook-disabled', 'Disable webhook integration')}
            description={t(
              'provisioning.webhook-section.description-webhook-disabled',
              'When enabled, Grafana will not register or receive webhook events and will poll the repository on an interval instead. Use this when Grafana is not reachable from the public internet.'
            )}
          />
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
            placeholder={t('provisioning.webhook-section.placeholder-webhook-url', 'https://grafana.example.com')}
          />
        </Field>
      </Stack>
    </ControlledCollapse>
  );
}
