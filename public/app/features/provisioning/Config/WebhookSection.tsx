import { type UseFormRegister } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { ControlledCollapse, Field, Input, Stack, TextLink } from '@grafana/ui';

import { checkPublicAccess } from '../GettingStarted/features';
import { GETTING_STARTED_URL } from '../constants';
import { type RepositoryFormData } from '../types';

export interface WebhookSectionProps {
  register: UseFormRegister<RepositoryFormData>;
}

export function WebhookSection({ register }: WebhookSectionProps) {
  const isPublic = checkPublicAccess();

  return (
    <ControlledCollapse label={t('provisioning.webhook-section.label-webhook', 'Webhook')} isOpen={false}>
      <Stack direction="column" gap={2}>
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
            {...register('webhook.baseUrl')}
            placeholder={t('provisioning.webhook-section.placeholder-webhook-url', 'https://grafana.example.com')}
          />
        </Field>
      </Stack>
    </ControlledCollapse>
  );
}
