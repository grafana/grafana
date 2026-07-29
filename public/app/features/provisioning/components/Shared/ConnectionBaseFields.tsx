import { useFormContext } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Field, Input, Stack } from '@grafana/ui';

import { type ConnectionFormData } from '../../types';

export interface ConnectionBaseFieldsProps {
  /** Whether fields are required. Depends if we are in edit mode or not. */
  required?: boolean;
  type: ConnectionFormData['type'];
}

export function ConnectionBaseFields({ required = true, type }: ConnectionBaseFieldsProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ConnectionFormData>();

  const requiredValidation = required
    ? t('provisioning.connection-form.error-required', 'This field is required')
    : false;

  return (
    <Stack direction="column" gap={2}>
      <Field
        noMargin
        label={t('provisioning.connection-form.label-title', 'Title')}
        description={t('provisioning.connection-form.description-title', 'A human-readable name for this connection')}
        error={errors?.title?.message}
        invalid={!!errors.title}
        required={required}
      >
        <Input
          id="title"
          data-testid={selectors.pages.Provisioning.ConnectionForm.titleInput}
          {...register('title', {
            required: requiredValidation,
          })}
          placeholder={t('provisioning.connection-form.placeholder-title', 'My App')}
        />
      </Field>

      <Field
        noMargin
        label={t('provisioning.connection-form.label-description', 'Description')}
        description={t(
          'provisioning.connection-form.description-description',
          'Optional description for this connection'
        )}
        error={errors?.description?.message}
        invalid={!!errors.description}
      >
        <Input
          id="description"
          data-testid={selectors.pages.Provisioning.ConnectionForm.descriptionInput}
          {...register('description')}
          placeholder={t('provisioning.connection-form.placeholder-description', 'Optional description')}
        />
      </Field>

      {(type === 'githubEnterprise' || type === 'githubEnterpriseOAuth') && (
        <Field
          noMargin
          label={t('provisioning.github-enterprise.server-url-label', 'Custom server URL')}
          description={t(
            'provisioning.github-enterprise.server-url-description',
            'The custom server URL where your GitHub Enterprise is hosted'
          )}
          invalid={!!errors.serverUrl}
          error={errors.serverUrl?.message}
          required={required}
        >
          <Input
            id="serverUrl"
            data-testid={selectors.pages.Provisioning.ConnectionForm.serverUrlInput}
            {...register('serverUrl', {
              required: requiredValidation,
            })}
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="https://your-enterprise-url.com or https://<enterprise-slug>.ghe.com"
          />
        </Field>
      )}
    </Stack>
  );
}
