import { useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { isFetchError, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Combobox, Field, Stack } from '@grafana/ui';
import { type Connection, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { OAuthConnectionFields } from '../components/Shared/OAuthConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { CONNECTIONS_TAB_URL, CONNECTIONS_URL } from '../constants';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { type ConnectionFormData } from '../types';
import { buildOAuthAuthorizeUrl, isOAuthConnectionType, onOAuthAuthorizationComplete } from '../utils/connectionOAuth';
import { extractFormErrors, getConnectionFormErrors } from '../utils/getFormErrors';
import { isGitHubBased } from '../utils/repositoryTypes';

import { DeleteConnectionButton } from './DeleteConnectionButton';

interface ConnectionFormProps {
  data?: Connection;
}

export function ConnectionForm({ data }: ConnectionFormProps) {
  const connectionName = data?.metadata?.name;
  const isEdit = Boolean(connectionName);
  const privateKey = data?.secure?.privateKey;
  const [submitData, request] = useCreateOrUpdateConnection(connectionName);
  const navigate = useNavigate();

  const { data: frontendSettings } = useGetFrontendSettingsQuery();
  const availableTypes = frontendSettings?.availableRepositoryTypes ?? [];
  const providerOptions = [
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    { value: 'github', label: 'GitHub' },
    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
    { value: 'githubOAuth', label: 'GitHub OAuth App' },
    ...(availableTypes.includes('githubEnterprise')
      ? [
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          { value: 'githubEnterprise', label: 'GitHub Enterprise' },
          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
          { value: 'githubEnterpriseOAuth', label: 'GitHub Enterprise OAuth App' },
        ]
      : []),
    ...(availableTypes.includes('gitlab')
      ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        [{ value: 'gitlab', label: 'GitLab' }]
      : []),
    ...(availableTypes.includes('bitbucket')
      ? // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        [{ value: 'bitbucket', label: 'Bitbucket' }]
      : []),
  ];

  const formMethods = useForm<ConnectionFormData>({
    defaultValues:
      isOAuthConnectionType(data?.spec?.type)
        ? {
            type: data.spec.type,
            title: data?.spec?.title || '',
            description: data?.spec?.description || '',
            clientID: data.spec.oauth?.clientID || '',
            clientSecret: '',
            workspace: data.spec.bitbucket?.workspace || '',
            serverUrl: data.spec.githubEnterpriseOAuth?.serverUrl || '',
            webhookDisabled: data?.spec?.webhook?.disabled ?? false,
          }
        : data?.spec?.type === 'githubEnterprise'
        ? {
            type: 'githubEnterprise',
            title: data?.spec?.title || '',
            description: data?.spec?.description || '',
            appID: data?.spec?.githubEnterprise?.appID || '',
            installationID: data?.spec?.githubEnterprise?.installationID || '',
            privateKey: '',
            webhookDisabled: data?.spec?.webhook?.disabled ?? false,
            serverUrl: data?.spec?.githubEnterprise?.serverUrl || '',
          }
        : {
            type: 'github',
            title: data?.spec?.title || '',
            description: data?.spec?.description || '',
            appID: data?.spec?.github?.appID || '',
            installationID: data?.spec?.github?.installationID || '',
            privateKey: '',
            webhookDisabled: data?.spec?.webhook?.disabled ?? false,
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

  const authTabRef = useRef<Window | null>(null);
  const [pendingAuthorizeName, setPendingAuthorizeName] = useState<string>();

  useEffect(() => {
    if (!pendingAuthorizeName) {
      return;
    }
    return onOAuthAuthorizationComplete((name) => {
      if (name === pendingAuthorizeName) {
        navigate(`${CONNECTIONS_URL}/${name}/edit`);
      }
    });
  }, [pendingAuthorizeName, navigate]);

  useEffect(() => {
    if (request.isSuccess) {
      const formData = getValues();

      reportInteraction('grafana_provisioning_connection_saved', {
        connectionName: connectionName ?? 'unknown',
        connectionType: formData.type,
      });

      reset(formData);

      // OAuth app connections need the user to authorize the app before tokens can be issued
      if (isOAuthConnectionType(formData.type) && (!isEdit || formData.clientSecret)) {
        const name = connectionName ?? request.data?.metadata?.name;
        if (name && formData.clientID) {
          const url = buildOAuthAuthorizeUrl(formData.type, formData.clientID, name, formData.serverUrl, {
            popup: true,
          });
          if (authTabRef.current) {
            authTabRef.current.location.href = url;
            authTabRef.current = null;
          } else {
            window.open(url, '_blank');
          }
          setPendingAuthorizeName(name);
          return;
        }
      }

      authTabRef.current?.close();
      authTabRef.current = null;

      // use timeout to ensure the form resets before navigating
      setTimeout(() => navigate(CONNECTIONS_TAB_URL), 300);
    }
  }, [request.isSuccess, request.data, reset, getValues, connectionName, navigate, isEdit]);

  useEffect(() => {
    if (isEdit && data?.status?.fieldErrors?.length) {
      const errors = getConnectionFormErrors(data.status.fieldErrors);
      for (const [field, errorMessage] of errors) {
        setError(field, errorMessage);
      }
    }
  }, [isEdit, data?.status?.fieldErrors, setError]);

  const [submitError, setSubmitError] = useState<string>();

  const needsReauthorization =
    isEdit &&
    isOAuthConnectionType(data?.spec?.type) &&
    Boolean(
      data?.status?.conditions?.some(
        (c) => c.type === 'Ready' && c.status === 'False' && c.reason === 'AuthenticationFailed'
      )
    );

  const handleReauthorize = () => {
    const formData = getValues();
    if (connectionName && formData.clientID && isOAuthConnectionType(formData.type)) {
      const url = buildOAuthAuthorizeUrl(formData.type, formData.clientID, connectionName, formData.serverUrl, {
        popup: true,
      });
      window.open(url, '_blank');
      setPendingAuthorizeName(connectionName);
    }
  };

  const onSubmit = async (form: ConnectionFormData) => {
    setSubmitError(undefined);
    // Open the tab synchronously so popup blockers allow it; navigate it once
    // the connection is saved.
    if (isOAuthConnectionType(form.type) && (!isEdit || form.clientSecret) && form.clientID) {
      authTabRef.current = window.open('', '_blank');
    }
    try {
      const spec = {
        title: form.title,
        type: form.type,
        ...(form.description && { description: form.description }),
        ...(form.webhookDisabled ? { webhook: { disabled: true } } : {}),
        ...(form.type === 'githubEnterprise'
          ? {
              githubEnterprise: {
                appID: form.appID ?? '',
                installationID: form.installationID ?? '',
                serverUrl: form.serverUrl,
              },
            }
          : form.type === 'github'
            ? {
                github: {
                  appID: form.appID ?? '',
                  installationID: form.installationID ?? '',
                },
              }
            : {
                oauth: { clientID: form.clientID ?? '' },
                ...(form.type === 'githubEnterpriseOAuth' ? { githubEnterpriseOAuth: { serverUrl: form.serverUrl ?? '' } } : {}),
                ...(form.type === 'bitbucket' ? { bitbucket: { workspace: form.workspace ?? '' } } : {}),
              }),
      };

      await submitData(spec, form.privateKey, form.clientSecret);
    } catch (err) {
      authTabRef.current?.close();
      authTabRef.current = null;
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
          {needsReauthorization && (
            <Alert
              severity="warning"
              title={t('provisioning.connection-form.reauthorize-title', 'Authorization expired')}
              buttonContent={t('provisioning.connection-form.reauthorize-button', 'Reauthorize')}
              onRemove={handleReauthorize}
            >
              {t(
                'provisioning.connection-form.reauthorize-body',
                'The provider rejected the connection credentials. Reauthorize to restore access.'
              )}
            </Alert>
          )}
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
                  disabled={isEdit || providerOptions.length <= 1}
                  options={providerOptions}
                  onChange={(option) => onChange(option?.value)}
                  {...field}
                />
              )}
            />
          </Field>

          {isGitHubBased(selectedType) && (
            <GitHubConnectionFields required={!isEdit} privateKeyConfigured={Boolean(privateKey)} type={selectedType} />
          )}

          {isOAuthConnectionType(selectedType) && (
            <OAuthConnectionFields
              required={!isEdit}
              clientSecretConfigured={Boolean(data?.secure?.clientSecret)}
              type={selectedType}
            />
          )}

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
