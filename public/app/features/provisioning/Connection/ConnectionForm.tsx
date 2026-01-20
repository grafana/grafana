import { useEffect } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { isFetchError, reportInteraction } from '@grafana/runtime';
import { Button, Combobox, Field, Stack } from '@grafana/ui';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { GitHubAppCredentialFields } from '../components/Shared/GitHubAppCredentialFields';
import { CONNECTIONS_URL } from '../constants';
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
  const [submitData, request] = useCreateOrUpdateConnection(connectionName);
  const navigate = useNavigate();

  const formMethods = useForm<ConnectionFormData>({
    defaultValues: {
      type: data?.spec?.type || 'github',
      appID: data?.spec?.github?.appID || '',
      installationID: data?.spec?.github?.installationID || '',
      privateKey: privateKey?.name || '',
    },
  });

  const {
    handleSubmit,
    reset,
    control,
    formState: { isDirty },
    getValues,
    setError,
  } = formMethods;

  useEffect(() => {
    if (request.isSuccess) {
      const formData = getValues();

      reportInteraction('grafana_provisioning_connection_saved', {
        connectionName: connectionName ?? 'unknown',
        connectionType: formData.type,
      });

      reset(formData);
      // use timeout to ensure the form resets before navigating
      setTimeout(() => navigate(CONNECTIONS_URL), 300);
    }
  }, [request.isSuccess, reset, getValues, connectionName, navigate]);

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
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 700 }}>
        <FormPrompt onDiscard={reset} confirmRedirect={isDirty} />
        <Stack direction="column" gap={2}>
          <Field
            noMargin
            htmlFor="type"
            label={t('provisioning.connection-form.label-provider', 'Provider')}
            description={t('provisioning.connection-form.description-provider', 'Select the provider type')}
          >
            <Controller
              name="type"
              control={control}
              render={({ field: { ref, onChange, ...field } }) => (
                <Combobox
                  id="type"
                  disabled // TODO enable when other providers are supported
                  options={providerOptions}
                  onChange={(option) => onChange(option?.value)}
                  {...field}
                />
              )}
            />
          </Field>

          <GitHubAppCredentialFields
            required={!isEdit}
            privateKeyConfigured={Boolean(privateKey)}
          />

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
    </FormProvider>
  );
}
