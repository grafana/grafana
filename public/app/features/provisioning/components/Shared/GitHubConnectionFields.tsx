import { memo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Input, SecretTextArea, Stack } from '@grafana/ui';

import { ConnectionFormData } from '../../types';

export interface GitHubConnectionFieldsProps {
  /** Whether fields are required. Depends if we are in edit mode or not. */
  required?: boolean;
  /** Initial value for whether private key is configured (edit mode) */
  privateKeyConfigured?: boolean;
}

export const GitHubConnectionFields = memo<GitHubConnectionFieldsProps>(
  ({ required = true, privateKeyConfigured = false }) => {
    const [isPrivateKeyConfigured, setIsPrivateKeyConfigured] = useState(privateKeyConfigured);
    const {
      register,
      control,
      setValue,
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
            {...register('title', {
              required: requiredValidation,
            })}
            placeholder={t('provisioning.connection-form.placeholder-title', 'My GitHub App')}
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
            {...register('description')}
            placeholder={t('provisioning.connection-form.placeholder-description', 'Optional description')}
          />
        </Field>

        <Field
          noMargin
          label={t('provisioning.connection-form.label-app-id', 'GitHub App ID')}
          description={t('provisioning.connection-form.description-app-id', 'The ID of your GitHub App')}
          invalid={!!errors.appID}
          error={errors.appID?.message}
          required={required}
        >
          <Input
            id="appID"
            {...register('appID', {
              required: requiredValidation,
            })}
            placeholder={t('provisioning.connection-form.placeholder-app-id', '123456')}
          />
        </Field>

        <Field
          noMargin
          label={t('provisioning.connection-form.label-installation-id', 'GitHub Installation ID')}
          description={t(
            'provisioning.connection-form.description-installation-id',
            'The installation ID of your GitHub App'
          )}
          invalid={!!errors.installationID}
          error={errors.installationID?.message}
          required={required}
        >
          <Input
            id="installationID"
            {...register('installationID', {
              required: requiredValidation,
            })}
            placeholder={t('provisioning.connection-form.placeholder-installation-id', '12345678')}
          />
        </Field>

        <Field
          noMargin
          htmlFor="privateKey"
          label={t('provisioning.connection-form.label-private-key', 'Private Key (PEM)')}
          description={t(
            'provisioning.connection-form.description-private-key',
            'The private key for your GitHub App in PEM format'
          )}
          invalid={!!errors.privateKey}
          error={errors.privateKey?.message}
          required={required}
        >
          <Controller
            name="privateKey"
            control={control}
            rules={{
              required: requiredValidation,
            }}
            render={({ field: { ref, ...field } }) => (
              <SecretTextArea
                {...field}
                id="privateKey"
                invalid={!!errors.privateKey}
                placeholder={t(
                  'provisioning.connection-form.placeholder-private-key',
                  '-----BEGIN RSA PRIVATE KEY-----...'
                )}
                isConfigured={isPrivateKeyConfigured}
                onReset={() => {
                  setValue('privateKey', '');
                  setIsPrivateKeyConfigured(false);
                }}
                rows={8}
                grow
              />
            )}
          />
        </Field>
      </Stack>
    );
  }
);
GitHubConnectionFields.displayName = 'GitHubConnectionFields';
