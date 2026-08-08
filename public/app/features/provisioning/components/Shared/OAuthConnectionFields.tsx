import { memo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, SecretInput, Stack } from '@grafana/ui';

import { type ConnectionFormData, type OAuthConnectionType } from '../../types';

export interface OAuthConnectionFieldsProps {
  /** Whether fields are required. Depends if we are in edit mode or not. */
  required?: boolean;
  /** Initial value for whether client secret is configured (edit mode) */
  clientSecretConfigured?: boolean;
  type: OAuthConnectionType;
  /** When set, renders a create button that calls this handler (wizard inline creation) */
  onNewConnectionCreation?: () => void;
  isCreating?: boolean;
}

export const OAuthConnectionFields = memo<OAuthConnectionFieldsProps>(
  ({ required = true, clientSecretConfigured = false, type, onNewConnectionCreation, isCreating = false }) => {
    const [isClientSecretConfigured, setIsClientSecretConfigured] = useState(clientSecretConfigured);
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
          label={
            type === 'gitlab'
              ? t('provisioning.connection-form.label-application-id', 'Application ID')
              : t('provisioning.connection-form.label-client-id', 'Client ID')
          }
          description={t('provisioning.connection-form.description-client-id', 'The identifier of your OAuth app')}
          invalid={!!errors.clientID}
          error={errors.clientID?.message}
          required={required}
        >
          <Input
            id="clientID"
            {...register('clientID', {
              required: requiredValidation,
            })}
          />
        </Field>

        {type === 'bitbucket' && (
          <Field
            noMargin
            label={t('provisioning.connection-form.label-workspace', 'Workspace')}
            description={t(
              'provisioning.connection-form.description-workspace',
              'The workspace your OAuth consumer belongs to'
            )}
            invalid={!!errors.workspace}
            error={errors.workspace?.message}
            required={required}
          >
            <Input
              id="workspace"
              {...register('workspace', {
                required: requiredValidation,
              })}
            />
          </Field>
        )}

        <Field
          noMargin
          htmlFor="clientSecret"
          label={t('provisioning.connection-form.label-client-secret', 'Client secret')}
          description={t('provisioning.connection-form.description-client-secret', 'The secret of your OAuth app')}
          invalid={!!errors.clientSecret}
          error={errors.clientSecret?.message}
          required={required}
        >
          <Controller
            name="clientSecret"
            control={control}
            rules={{
              required: requiredValidation,
            }}
            render={({ field: { ref, ...field } }) => (
              <SecretInput
                {...field}
                id="clientSecret"
                value={field.value ?? ''}
                invalid={!!errors.clientSecret}
                isConfigured={isClientSecretConfigured}
                revealable
                onReset={() => {
                  setValue('clientSecret', '');
                  setIsClientSecretConfigured(false);
                }}
              />
            )}
          />
        </Field>

        {onNewConnectionCreation && (
          <Stack>
            <Button onClick={onNewConnectionCreation} disabled={isCreating}>
              {isCreating ? (
                <Trans i18nKey="provisioning.connection-form.creating-connection-button">Creating connection...</Trans>
              ) : (
                <Trans i18nKey="provisioning.oauth-app.create-and-authorize-button">Create and authorize</Trans>
              )}
            </Button>
          </Stack>
        )}
      </Stack>
    );
  }
);
OAuthConnectionFields.displayName = 'OAuthConnectionFields';
