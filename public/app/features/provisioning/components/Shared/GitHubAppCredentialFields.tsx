import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Input, SecretTextArea, Stack } from '@grafana/ui';

import { ConnectionFormData } from '../../types';

export interface GitHubAppCredentialFieldsProps {
  /** Whether fields are required */
  required?: boolean;
  /** Whether private key is already configured (edit mode) */
  privateKeyConfigured?: boolean;
  /** Callback when private key is reset */
  onPrivateKeyReset?: () => void;
}

export const GitHubAppCredentialFields = memo<GitHubAppCredentialFieldsProps>(
  ({ required = true, privateKeyConfigured = false, onPrivateKeyReset }) => {
    const {
      register,
      control,
      setValue,
      formState: { errors },
    } = useFormContext<ConnectionFormData>();

    return (
      <Stack direction="column" gap={2}>
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
              required: required ? t('provisioning.connection-form.error-required', 'This field is required') : false,
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
              required: required ? t('provisioning.connection-form.error-required', 'This field is required') : false,
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
              required: required ? t('provisioning.connection-form.error-required', 'This field is required') : false,
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
                isConfigured={privateKeyConfigured}
                onReset={() => {
                  setValue('privateKey', '');
                  onPrivateKeyReset?.();
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
GitHubAppCredentialFields.displayName = 'GitHubAppCredentialFields';
