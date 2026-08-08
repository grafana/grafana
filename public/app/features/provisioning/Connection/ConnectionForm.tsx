import { type ReactNode, useEffect, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, Combobox, Field, RadioButtonGroup, Stack } from '@grafana/ui';
import { type Connection, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { AppInstruction } from '../components/Shared/AppInstruction';
import { AuthorizationPendingAlert } from '../components/Shared/AuthorizationPendingAlert';
import { ConnectionBaseFields } from '../components/Shared/ConnectionBaseFields';
import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { OAuthConnectionFields } from '../components/Shared/OAuthConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { CONNECTIONS_TAB_URL } from '../constants';
import { useSaveConnection } from '../hooks/useSaveConnection';
import { type ConnectionFormData } from '../types';
import { type ConnectionProvider, getConnectionFormDefaults, toConnectionType } from '../utils/connectionData';
import { connectionProviderType, isOAuthConnectionType } from '../utils/connectionOAuth';
import { getConnectionFormErrors } from '../utils/getFormErrors';

import { DeleteConnectionButton } from './DeleteConnectionButton';

/* eslint-disable @grafana/i18n/no-untranslated-strings */
const PROVIDER_OPTIONS: Array<{
  value: ConnectionProvider;
  label: string;
  requiredType?: 'githubEnterprise' | 'gitlab' | 'bitbucket';
}> = [
  { value: 'github', label: 'GitHub' },
  { value: 'githubEnterprise', label: 'GitHub Enterprise', requiredType: 'githubEnterprise' },
  { value: 'gitlab', label: 'GitLab', requiredType: 'gitlab' },
  { value: 'bitbucket', label: 'Bitbucket', requiredType: 'bitbucket' },
];
/* eslint-enable @grafana/i18n/no-untranslated-strings */

interface ConnectionFormProps {
  data?: Connection;
  /** Rendered between the status alerts and the form fields */
  children?: ReactNode;
}

export function ConnectionForm({ data, children }: ConnectionFormProps) {
  const connectionName = data?.metadata?.name;
  const isEdit = Boolean(connectionName);
  const privateKey = data?.secure?.privateKey;
  const navigate = useNavigate();

  const { data: frontendSettings } = useGetFrontendSettingsQuery();
  const availableTypes = frontendSettings?.availableRepositoryTypes ?? [];
  const providerOptions = PROVIDER_OPTIONS.filter(
    (option) => !option.requiredType || availableTypes.includes(option.requiredType)
  );

  const formMethods = useForm<ConnectionFormData>({
    defaultValues: getConnectionFormDefaults(data?.spec?.type, data),
  });

  const {
    handleSubmit,
    reset,
    register,
    watch,
    setValue,
    formState: { isDirty, errors },
    setError,
  } = formMethods;

  const selectedType = watch('type');
  const selectedProvider = connectionProviderType(selectedType) ?? 'github';
  const selectedKind = isOAuthConnectionType(selectedType) ? 'oauth' : 'app';
  const reauthorizeRef = useRef(false);
  const navigateOnCompleteRef = useRef(false);

  const { save, request, submitError, setSubmitError, isAuthorizing } = useSaveConnection(() => {
    if (navigateOnCompleteRef.current) {
      navigate(CONNECTIONS_TAB_URL);
    }
  }, connectionName);

  // OAuth app connections need the user to authorize the app before tokens can be issued
  const needsAuthorization = (form: ConnectionFormData) =>
    isOAuthConnectionType(form.type) &&
    (!isEdit ||
      Boolean(form.clientSecret) ||
      form.clientID !== data?.spec?.oauth?.clientID ||
      (form.type === 'githubEnterpriseOAuth' && form.serverUrl !== data?.spec?.githubEnterpriseOAuth?.serverUrl) ||
      reauthorizeRef.current);

  useEffect(() => {
    if (isEdit && data?.status?.fieldErrors?.length) {
      const errors = getConnectionFormErrors(data.status.fieldErrors);
      for (const [field, errorMessage] of errors) {
        setError(field, errorMessage);
      }
    }
  }, [isEdit, data?.status?.fieldErrors, setError]);

  const readyCondition = data?.status?.conditions?.find((c) => c.type === 'Ready');
  const isConnected = isEdit && readyCondition?.status === 'True';
  const isDisconnected = isEdit && readyCondition?.status === 'False';
  // Field errors are shown inline in the form
  const showDisconnectMessage = readyCondition?.message && !data?.status?.fieldErrors?.length;

  const handleReauthorize = () => {
    reauthorizeRef.current = true;
    handleSubmit(onSubmit)();
  };

  const onSubmit = async (form: ConnectionFormData) => {
    navigateOnCompleteRef.current = !reauthorizeRef.current;
    const shouldAuthorize = needsAuthorization(form);
    reauthorizeRef.current = false;

    const result = await save({ form, authorize: shouldAuthorize, setError });
    if (result.status === 'error') {
      if (!result.fieldErrors) {
        setSubmitError(result.message || t('provisioning.connection-form.error-submit', 'Failed to save connection'));
      }
      return;
    }

    reportInteraction('grafana_provisioning_connection_saved', {
      connectionName: result.name,
      connectionType: form.type,
    });
    reset(form);

    if (result.status === 'saved') {
      // use timeout to ensure the form resets before navigating
      setTimeout(() => navigate(CONNECTIONS_TAB_URL), 300);
    }
  };

  return (
    <FormProvider {...formMethods}>
      <Stack direction="column" gap={2}>
        {(isAuthorizing || Boolean(submitError) || isConnected || isDisconnected) && (
          <div style={{ maxWidth: 700 }}>
            {submitError && <Alert severity="error" title={submitError} />}
            {isConnected && (
              <Alert severity="success" title={t('provisioning.connection.connected-title', 'Connected')} />
            )}
            {isDisconnected && (
              <Alert
                severity="error"
                title={t('provisioning.connection.disconnected-title', 'Disconnected')}
                action={
                  isOAuthConnectionType(data?.spec?.type) ? (
                    <Button variant="secondary" onClick={handleReauthorize}>
                      {t('provisioning.connection-form.reauthorize-button', 'Reauthorize')}
                    </Button>
                  ) : undefined
                }
              >
                {showDisconnectMessage ? (
                  readyCondition?.message
                ) : (
                  <Trans i18nKey="provisioning.connection.disconnected-message">
                    The provider rejected this connection. Check its configuration and access.
                  </Trans>
                )}
              </Alert>
            )}
            {isAuthorizing && <AuthorizationPendingAlert />}
          </div>
        )}

        {children}

        <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 700 }}>
          <FormPrompt onDiscard={reset} confirmRedirect={isDirty} />
          <Stack direction="column" gap={2}>
            <Field
              noMargin
              htmlFor="type"
              label={t('provisioning.connection-form.label-provider', 'Provider')}
              description={t('provisioning.connection-form.description-provider', 'Select the provider type')}
            >
              <Combobox
                id="type"
                disabled={isEdit || providerOptions.length <= 1}
                options={providerOptions}
                value={selectedProvider}
                onChange={(option) => {
                  if (option?.value) {
                    setValue('type', toConnectionType(option.value, selectedKind), { shouldDirty: true });
                  }
                }}
              />
            </Field>

            <ConnectionBaseFields required={!isEdit} type={selectedType} />

            {(selectedProvider === 'github' || selectedProvider === 'githubEnterprise') && (
              <Field noMargin label={t('provisioning.wizard.github-app-kind-label', 'App type')}>
                <RadioButtonGroup<'app' | 'oauth'>
                  disabled={isEdit}
                  options={[
                    { value: 'app', label: t('provisioning.wizard.github-app-kind-app', 'GitHub App') },
                    { value: 'oauth', label: t('provisioning.wizard.github-app-kind-oauth', 'OAuth App') },
                  ]}
                  value={selectedKind}
                  onChange={(kind) => setValue('type', toConnectionType(selectedProvider, kind), { shouldDirty: true })}
                />
              </Field>
            )}

            <AppInstruction type={selectedType} />

            {(selectedType === 'github' || selectedType === 'githubEnterprise') && (
              <GitHubConnectionFields required={!isEdit} privateKeyConfigured={Boolean(privateKey)} />
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
      </Stack>
    </FormProvider>
  );
}
