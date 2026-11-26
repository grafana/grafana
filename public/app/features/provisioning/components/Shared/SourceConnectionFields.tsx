import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Input, SecretInput, Stack, TagsInput } from '@grafana/ui';

import { type ConnectionFormData } from '../../types';
import { validateHttpUrl } from '../../utils/validators';

interface SourceConnectionFieldsProps {
  /** Whether fields are required. Depends if we are in edit mode or not. */
  required?: boolean;
  /** Initial value for whether client secret is configured (edit mode) */
  clientSecretConfigured?: boolean;
}

/** OAuth client-credentials settings of a Source API connection. The token is minted by Grafana, so there is no authorize step. */
export function SourceConnectionFields({
  required = true,
  clientSecretConfigured = false,
}: SourceConnectionFieldsProps) {
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
        htmlFor="tokenURL"
        label={t('provisioning.connection-form.label-token-url', 'Token URL')}
        description={t(
          'provisioning.source-connection.description-token-url',
          'The OAuth token endpoint that issues client-credentials tokens for the source'
        )}
        invalid={!!errors.tokenURL}
        error={errors.tokenURL?.message}
        required={required}
      >
        <Input
          id="tokenURL"
          {...register('tokenURL', {
            required: requiredValidation,
            validate: validateHttpUrl,
          })}
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          placeholder="https://idp.example.com/oauth/token"
        />
      </Field>

      <Field
        noMargin
        htmlFor="audience"
        label={t('provisioning.source-connection.label-audience', 'Audience')}
        description={t(
          'provisioning.source-connection.description-audience',
          'Optional. The audience to request, when the token endpoint needs one'
        )}
        invalid={!!errors.audience}
        error={errors.audience?.message}
      >
        <Input id="audience" {...register('audience')} />
      </Field>

      <Field
        noMargin
        htmlFor="scopes"
        label={t('provisioning.connection-form.label-scopes', 'Scopes')}
        description={t('provisioning.source-connection.description-scopes', 'Optional. The OAuth scopes to request')}
      >
        <Controller
          name="scopes"
          control={control}
          render={({ field: { value, onChange } }) => (
            <TagsInput
              id="scopes"
              tags={value ?? []}
              onChange={onChange}
              addOnBlur
              autoColors={false}
              placeholder={t('provisioning.connection-form.placeholder-scopes', 'Type a scope and press Enter')}
            />
          )}
        />
      </Field>

      <Field
        noMargin
        htmlFor="clientID"
        label={t('provisioning.connection-form.label-client-id', 'Client ID')}
        description={t(
          'provisioning.source-connection.description-client-id',
          'The client ID Grafana uses to authenticate to the token endpoint'
        )}
        invalid={!!errors.clientID}
        error={errors.clientID?.message}
        required={required}
      >
        <Input id="clientID" {...register('clientID', { required: requiredValidation })} />
      </Field>

      <Field
        noMargin
        htmlFor="clientSecret"
        label={t('provisioning.connection-form.label-client-secret', 'Client secret')}
        description={t(
          'provisioning.source-connection.description-client-secret',
          'The client secret Grafana uses to authenticate to the token endpoint'
        )}
        invalid={!!errors.clientSecret}
        error={errors.clientSecret?.message}
        required={required}
      >
        <Controller
          name="clientSecret"
          control={control}
          rules={{ required: requiredValidation }}
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
    </Stack>
  );
}
