import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents, isFetchError, reportInteraction } from '@grafana/runtime';
import { Button, Field, Input, RadioButtonGroup, SecretInput, Stack } from '@grafana/ui';
import { Connection, ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { CONNECTIONS_URL } from '../constants';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';

import { DeleteConnectionButton } from './DeleteConnectionButton';

interface ConnectionFormData {
  name: string;
  type: 'github' | 'gitlab' | 'bitbucket';
  appID: string;
  installationID: string;
  privateKey?: string;
}

interface ConnectionFormProps {
  data?: Connection;
}

const providerOptions = [
  { value: 'github', label: 'GitHub' },
  // Disabled for now:
  // { value: 'gitlab', label: 'GitLab', disabled: true },
  // { value: 'bitbucket', label: 'Bitbucket', disabled: true },
];

export function ConnectionForm({ data }: ConnectionFormProps) {
  const connectionName = data?.metadata?.name;
  const isEdit = Boolean(connectionName);
  const [privateKeyConfigured, setPrivateKeyConfigured] = useState(isEdit);
  const [isLoading, setIsLoading] = useState(false);
  const [submitData, request] = useCreateOrUpdateConnection(connectionName);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
    setValue,
    getValues,
  } = useForm<ConnectionFormData>({
    defaultValues: {
      name: data?.metadata?.name || '',
      type: data?.spec?.type || 'github',
      appID: data?.spec?.github?.appID || '',
      installationID: data?.spec?.github?.installationID || '',
      privateKey: '',
    },
  });

  useEffect(() => {
    if (request.isSuccess) {
      const formData = getValues();

      reportInteraction('grafana_provisioning_connection_saved', {
        connectionName: connectionName ?? formData.name,
        connectionType: formData.type,
      });

      reset(formData);
      setTimeout(() => {
        navigate(CONNECTIONS_URL);
      }, 300);
    }
  }, [request.isSuccess, reset, getValues, navigate, connectionName]);

  const onSubmit = async (form: ConnectionFormData) => {
    setIsLoading(true);
    try {
      const spec: ConnectionSpec = {
        type: form.type,
        github: {
          appID: form.appID,
          installationID: form.installationID,
        },
      };

      await submitData(spec, form.privateKey);
    } catch (err) {
      if (isFetchError(err)) {
        // Map API errors to form fields if possible
        const message = err.data?.message || err.statusText;
        if (message) {
          getAppEvents().publish({
            type: AppEvents.alertError.name,
            payload: [message],
          });
        }
      } else {
        // fallback for non-fetch errors
        getAppEvents().publish({
          type: AppEvents.alertError.name,
          payload: [t('provisioning.connection-form.error-save', 'Failed to save connection')],
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 700 }}>
      <FormPrompt onDiscard={reset} confirmRedirect={isDirty} />
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={t('provisioning.connection-form.label-name', 'Connection name')}
          description={t('provisioning.connection-form.description-name', 'A unique identifier for this connection')}
          invalid={!!errors.name}
          error={errors?.name?.message}
          required
        >
          <Input
            {...register('name', {
              required: t('provisioning.connection-form.error-required', 'This field is required'),
            })}
            placeholder={t('provisioning.connection-form.placeholder-name', 'my-github-connection')}
            disabled={isEdit}
          />
        </Field>

        <Field
          noMargin
          label={t('provisioning.connection-form.label-provider', 'Provider')}
          description={t('provisioning.connection-form.description-provider', 'Select the provider type')}
        >
          <Controller
            name="type"
            control={control}
            render={({ field: { ref, onChange, ...field } }) => (
              <RadioButtonGroup options={providerOptions} onChange={onChange} disabled {...field} />
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
              <SecretInput
                {...field}
                invalid={!!errors.privateKey}
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
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? t('provisioning.connection-form.button-saving', 'Saving...')
              : t('provisioning.connection-form.button-save', 'Save')}
          </Button>
          {connectionName && data && <DeleteConnectionButton name={connectionName} connection={data} />}
        </Stack>
      </Stack>
    </form>
  );
}
