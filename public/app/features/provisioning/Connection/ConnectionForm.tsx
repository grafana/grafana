import { useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, isFetchError, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Combobox, Field, Input, Stack } from '@grafana/ui';
import { type Connection } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { CONNECTIONS_TAB_URL } from '../constants';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { type ConnectionFormData } from '../types';
import { extractFormErrors, getConnectionFormErrors } from '../utils/getFormErrors';

import { DeleteConnectionButton } from './DeleteConnectionButton';

interface ConnectionFormProps {
  data?: Connection;
}

const providerOptions = [
  { value: 'github', label: 'GitHub' },
  ...(config.licenseInfo.edition === GrafanaEdition.Enterprise
    ? [{ value: 'githubEnterprise', label: 'GitHub Enterprise' }]
    : []),
];

export function ConnectionForm({ data }: ConnectionFormProps) {
  const connectionName = data?.metadata?.name;
  const isEdit = Boolean(connectionName);
  const privateKey = data?.secure?.privateKey;
  const [submitData, request] = useCreateOrUpdateConnection(connectionName);
  const navigate = useNavigate();

  const formMethods = useForm<ConnectionFormData>({
    defaultValues: {
      type: data?.spec?.type || 'github',
      title: data?.spec?.title || '',
      description: data?.spec?.description || '',
      appID: data?.spec?.github?.appID || data?.spec?.githubEnterprise?.appID || '',
      installationID: data?.spec?.github?.installationID || data?.spec?.githubEnterprise?.installationID || '',
      privateKey: '',
      webhookDisabled: data?.spec?.webhook?.disabled ?? false,
      serverUrl: data?.spec?.githubEnterprise?.serverUrl || '',
    },
  });

  const {
    handleSubmit,
    reset,
    register,
    control,
    watch,
    formState: { isDirty, errors },
    getValues,
    setError,
  } = formMethods;

  const selectedType = watch('type');

  useEffect(() => {
    if (request.isSuccess) {
      const formData = getValues();

      reportInteraction('grafana_provisioning_connection_saved', {
        connectionName: connectionName ?? 'unknown',
        connectionType: formData.type,
      });

      reset(formData);
      // use timeout to ensure the form resets before navigating
      setTimeout(() => navigate(CONNECTIONS_TAB_URL), 300);
    }
  }, [request.isSuccess, reset, getValues, connectionName, navigate]);

  useEffect(() => {
    if (isEdit && data?.status?.fieldErrors?.length) {
      const errors = getConnectionFormErrors(data.status.fieldErrors);
      for (const [field, errorMessage] of errors) {
        setError(field, errorMessage);
      }
    }
  }, [isEdit, data?.status?.fieldErrors, setError]);

  const [submitError, setSubmitError] = useState<string>();

  const onSubmit = async (form: ConnectionFormData) => {
    setSubmitError(undefined);
    try {
      const spec = {
        title: form.title,
        type: form.type,
        ...(form.description && { description: form.description }),
        ...(form.webhookDisabled ? { webhook: { disabled: true } } : {}),
        ...(form.type === 'githubEnterprise'
          ? {
              githubEnterprise: {
                appID: form.appID,
                installationID: form.installationID,
                serverUrl: form.serverUrl,
              },
            }
          : {
              github: {
                appID: form.appID,
                installationID: form.installationID,
              },
            }),
      };

      await submitData(spec, form.privateKey);
    } catch (err) {
      if (isFetchError(err)) {
        const errors = getConnectionFormErrors(err.data);

        if (errors.length > 0) {
          for (const [field, errorMessage] of errors) {
            setError(field, errorMessage);
          }
          return;
        }

        // Show unmapped error details as a top-level form error
        const allErrors = extractFormErrors(err.data);
        const detail = allErrors.find((e) => e.detail)?.detail;
        if (detail) {
          setSubmitError(detail);
          return;
        }
      }

      setSubmitError(
        extractErrorMessage(err) || t('provisioning.connection-form.error-submit', 'Failed to save connection')
      );
    }
  };

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 700 }}>
        <FormPrompt onDiscard={reset} confirmRedirect={isDirty} />
        <Stack direction="column" gap={2}>
          {submitError && <Alert severity="error" title={submitError} />}
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
                  disabled={providerOptions.length <= 1}
                  options={providerOptions}
                  onChange={(option) => onChange(option?.value)}
                  {...field}
                />
              )}
            />
          </Field>

          {selectedType === 'githubEnterprise' && (
            <Field
              noMargin
              label={t('provisioning.connection-form.label-server-url', 'Server URL')}
              description={t(
                'provisioning.connection-form.description-server-url',
                'The URL of your GitHub Enterprise Server'
              )}
              invalid={!!errors.serverUrl}
              error={errors.serverUrl?.message}
              required={!isEdit}
            >
              <Input
                id="serverUrl"
                {...register('serverUrl', {
                  required: !isEdit
                    ? t('provisioning.connection-form.error-required', 'This field is required')
                    : false,
                })}
                placeholder={t(
                  'provisioning.connection-form.placeholder-server-url',
                  'https://your-custom-github-enterprise-url.com'
                )}
              />
            </Field>
          )}

          <GitHubConnectionFields
            required={!isEdit}
            privateKeyConfigured={Boolean(privateKey)}
            type={data?.spec?.type || 'github'}
          />

          <WebhookDisabledField
            registration={register('webhookDisabled')}
            invalid={!!errors.webhookDisabled}
            error={errors.webhookDisabled?.message}
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
