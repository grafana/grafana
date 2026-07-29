import { memo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, SecretInput, Stack } from '@grafana/ui';

import { type ConnectionFormData, type OAuthConnectionType } from '../../types';

import { OAuthAppInstruction } from './OAuthAppInstruction';

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
        <OAuthAppInstruction type={type} />

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
            placeholder={
              type === 'gitlab'
                ? t('provisioning.connection-form.placeholder-title-gitlab', 'My GitLab App')
                : type === 'githubOAuth' || type === 'githubEnterpriseOAuth'
                  ? t('provisioning.connection-form.placeholder-title-github-oauth', 'My GitHub OAuth App')
                  : t('provisioning.connection-form.placeholder-title-bitbucket', 'My Bitbucket App')
            }
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

        {type === 'githubEnterpriseOAuth' && (
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
              {...register('serverUrl', {
                required: requiredValidation,
              })}
              // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="https://your-enterprise-url.com or https://<enterprise-slug>.ghe.com"
            />
          </Field>
        )}

        <Field
          noMargin
          label={t('provisioning.connection-form.label-client-id', 'Client ID')}
          description={t('provisioning.connection-form.description-client-id', 'The application ID of your OAuth app')}
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
