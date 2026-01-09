import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { isFetchError, reportInteraction } from '@grafana/runtime';
import { Button, Combobox, Field, Input, Stack } from '@grafana/ui';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { SecretTextArea } from '../Shared/SecretTextArea';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { ConnectionFormData } from '../types';
import { getConnectionFormErrors } from '../utils/getFormErrors';

import { DeleteConnectionButton } from './DeleteConnectionButton';

interface ConnectionFormProps {
  data?: Connection;
}

const providerOptions = [{ value: 'github', label: 'GitHub' }];

export function ConnectionForm({ data }: ConnectionFormProps) {
  const connectionName = data?.metadata?.name;
  const isEdit = Boolean(connectionName);
  const privateKey = data?.secure?.privateKey;
  const [privateKeyConfigured, setPrivateKeyConfigured] = useState(Boolean(privateKey));
  const [submitData, request] = useCreateOrUpdateConnection(connectionName);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
    setValue,
    getValues,
    setError,
  } = useForm<ConnectionFormData>({
    defaultValues: {
      type: data?.spec?.type || 'github',
      appID: data?.spec?.github?.appID || '',
      installationID: data?.spec?.github?.installationID || '',
      privateKey: privateKey?.name || '',
    },
  });

  useEffect(() => {
    if (request.isSuccess) {
      const formData = getValues();

      reportInteraction('grafana_provisioning_connection_saved', {
        connectionName: connectionName ?? 'unknown',
        connectionType: formData.type,
      });

      reset(formData);
    }
  }, [request.isSuccess, reset, getValues, connectionName]);

  const onSubmit = async (form: ConnectionFormData) => {
    try {
      const spec = {
        type: form.type,
        github: {
          appID: form.appID,
          installationID: form.installationID,
        },
      };

      await submitData(spec, form.privateKey);
    } catch (err) {
      if (isFetchError(err)) {
        const [field, errorMessage] = getConnectionFormErrors(err.data?.errors);

        if (field && errorMessage) {
          setError(field, errorMessage);
          return;
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 700 }}>
      <FormPrompt onDiscard={reset} confirmRedirect={isDirty} />
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('provisioning.connection-form.label-provider', 'Provider')}
          description={t('provisioning.connection-form.description-provider', 'Select the provider type')}
        >
          <Controller
            name="type"
            control={control}
            render={({ field: { ref, onChange, ...field } }) => (
              <Combobox
                disabled // TODO enable when other providers are supported
                options={providerOptions}
                onChange={(option) => onChange(option?.value)}
                {...field}
              />
            )}
          />
        </Field>

        <Field
          noMargin
          label={t('provisioning.connection-form.label-app-id', 'GitHub App ID')}
          description={t('provisioning.connection-form.description-app-id', 'The ID of your GitHub App')}
          invalid={!!errors.appID}
          error={errors?.appID?.message}
          required
        >
          <Input
            {...register('appID', {
              required: t('provisioning.connection-form.error-required', 'This field is required'),
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
          error={errors?.installationID?.message}
          required
        >
          <Input
            {...register('installationID', {
              required: t('provisioning.connection-form.error-required', 'This field is required'),
            })}
            placeholder={t('provisioning.connection-form.placeholder-installation-id', '12345678')}
          />
        </Field>

        <Field
          noMargin
          label={t('provisioning.connection-form.label-private-key', 'Private Key (PEM)')}
          description={t(
            'provisioning.connection-form.description-private-key',
            'The private key for your GitHub App in PEM format'
          )}
          invalid={!!errors.privateKey}
          error={errors?.privateKey?.message}
          required={!isEdit}
        >
          <Controller
            name="privateKey"
            control={control}
            rules={{
              required: isEdit ? false : t('provisioning.connection-form.error-required', 'This field is required'),
            }}
            render={({ field: { ref, ...field } }) => (
              <SecretTextArea
                {...field}
                id="privateKey"
                placeholder={t(
                  'provisioning.connection-form.placeholder-private-key',
                  '-----BEGIN RSA PRIVATE KEY-----...'
                )}
                isConfigured={privateKeyConfigured}
                onReset={() => {
                  setValue('privateKey', '');
                  setPrivateKeyConfigured(false);
                }}
                rows={8}
              />
            )}
          />
        </Field>

        <Stack gap={2}>
          <Button type="submit" disabled={request.isLoading}>
            {request.isLoading
              ? t('provisioning.connection-form.button-saving', 'Saving...')
              : t('provisioning.connection-form.button-save', 'Save')}
          </Button>
          {connectionName && data && <DeleteConnectionButton name={connectionName} connection={data} />}
        </Stack>
      </Stack>
    </form>
  );
}
