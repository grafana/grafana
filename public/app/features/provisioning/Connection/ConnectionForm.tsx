import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, Combobox, Field, LoadingPlaceholder, RadioButtonGroup, Spinner, Stack } from '@grafana/ui';
import {
  type Connection,
  type ConnectionSpec,
  useGetFrontendSettingsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';

import { AppInstruction } from '../components/Shared/AppInstruction';
import { ConnectionBaseFields } from '../components/Shared/ConnectionBaseFields';
import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { OAuthConnectionFields } from '../components/Shared/OAuthConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { CONNECTIONS_TAB_URL } from '../constants';
import { useSaveConnection } from '../hooks/useSaveConnection';
import { type ConnectionFormData } from '../types';
import { type ConnectionProvider, getConnectionFormDefaults, toConnectionType } from '../utils/connectionData';
import { connectionProviderType, isOAuthConnectionType } from '../utils/connectionOAuth';
import { isConnectionPending } from '../utils/connectionStatus';
import { getConnectionFormErrors } from '../utils/getFormErrors';

import { DeleteConnectionButton } from './DeleteConnectionButton';

/* eslint-disable @grafana/i18n/no-untranslated-strings */
const PROVIDER_OPTIONS: Array<{
  value: ConnectionProvider;
  label: string;
  types: Array<ConnectionSpec['type']>;
}> = [
  { value: 'github', label: 'GitHub', types: ['github', 'githubOAuth'] },
  {
    value: 'githubEnterprise',
    label: 'GitHub Enterprise',
    types: ['githubEnterprise', 'githubEnterpriseOAuth'],
  },
  { value: 'gitlab', label: 'GitLab', types: ['gitlabOAuth'] },
  { value: 'bitbucket', label: 'Bitbucket', types: ['bitbucketOAuth'] },
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

  const { data: frontendSettings, isLoading: settingsLoading } = useGetFrontendSettingsQuery();
  const availableTypes = useMemo(
    () => frontendSettings?.availableConnectionTypes ?? [],
    [frontendSettings?.availableConnectionTypes]
  );
  const providerOptions = PROVIDER_OPTIONS.filter((option) =>
    option.types.some((type) => availableTypes.includes(type))
  );
  const firstAvailableType = PROVIDER_OPTIONS.flatMap((option) => option.types).find((type) =>
    availableTypes.includes(type)
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
  const selectedTypeAvailable = availableTypes.includes(selectedType);
  const selectedProvider = connectionProviderType(selectedType) ?? 'github';
  const selectedKind = isOAuthConnectionType(selectedType) ? 'oauth' : 'app';
  const kindOptions = [
    ...(availableTypes.includes(toConnectionType(selectedProvider, 'app'))
      ? [{ value: 'app' as const, label: t('provisioning.wizard.github-app-kind-app', 'GitHub App') }]
      : []),
    ...(availableTypes.includes(toConnectionType(selectedProvider, 'oauth'))
      ? [{ value: 'oauth' as const, label: t('provisioning.wizard.github-app-kind-oauth', 'OAuth App') }]
      : []),
  ];
  const reauthorizeRef = useRef(false);
  const navigateOnCompleteRef = useRef(false);

  const { save, request, submitError, setSubmitError, isAuthorizing, cancelAuthorization } = useSaveConnection(() => {
    if (navigateOnCompleteRef.current) {
      navigate(CONNECTIONS_TAB_URL);
    }
  }, connectionName);

  // The client secret belongs to the OAuth app itself; pointing the connection at
  // a different app (client ID, or GHES host) makes the stored secret invalid for
  // the code exchange, so the user must supply the new app's secret.
  const oauthIdentityChanged = (form: ConnectionFormData) =>
    isEdit &&
    isOAuthConnectionType(form.type) &&
    (form.clientID !== data?.spec?.oauth?.clientID ||
      (form.type === 'githubEnterpriseOAuth' && form.serverUrl !== data?.spec?.githubEnterpriseOAuth?.serverUrl));

  // OAuth app connections need the user to authorize the app before tokens can be issued
  const needsAuthorization = (form: ConnectionFormData) =>
    isOAuthConnectionType(form.type) &&
    (!isEdit ||
      Boolean(form.clientSecret) ||
      oauthIdentityChanged(form) ||
      (form.type === 'bitbucketOAuth' && (form.workspace ?? '') !== (data?.spec?.bitbucket?.workspace ?? '')) ||
      reauthorizeRef.current);

  useEffect(() => {
    if (!isEdit && firstAvailableType && !selectedTypeAvailable) {
      setValue('type', firstAvailableType);
    }
  }, [firstAvailableType, isEdit, selectedTypeAvailable, setValue]);

  useEffect(() => {
    if (isEdit && data?.status?.fieldErrors?.length) {
      const errors = getConnectionFormErrors(data.status.fieldErrors);
      for (const [field, errorMessage] of errors) {
        setError(field, errorMessage);
      }
    }
  }, [isEdit, data?.status?.fieldErrors, setError]);

  const readyCondition = data?.status?.conditions?.find((c) => c.type === 'Ready');
  const isPending = isAuthorizing || (isEdit && isConnectionPending(data?.status));
  const isConnected = isEdit && !isPending && readyCondition?.status === 'True';
  const isDisconnected = isEdit && !isPending && readyCondition?.status === 'False';
  // Field errors are shown inline in the form
  const showDisconnectMessage = readyCondition?.message && !data?.status?.fieldErrors?.length;

  const handleReauthorize = () => {
    reauthorizeRef.current = true;
    handleSubmit(onSubmit)();
  };

  const onSubmit = async (form: ConnectionFormData) => {
    if (oauthIdentityChanged(form) && !form.clientSecret) {
      setError('clientSecret', {
        type: 'validate',
        message: t(
          'provisioning.connection-form.error-client-secret-new-app',
          'Enter the client secret for the new OAuth app.'
        ),
      });
      return;
    }
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

  if (!isEdit && (settingsLoading || (firstAvailableType && !selectedTypeAvailable))) {
    return <LoadingPlaceholder text={t('provisioning.connection-form.loading-types', 'Loading connection types...')} />;
  }

  if (!isEdit && !firstAvailableType) {
    return (
      <Alert severity="info" title={t('provisioning.connection-form.no-types-title', 'No connection types available')}>
        <Trans i18nKey="provisioning.connection-form.no-types-message">
          Enable at least one connection type in the provisioning configuration.
        </Trans>
      </Alert>
    );
  }

  return (
    <FormProvider {...formMethods}>
      <Stack direction="column" gap={2}>
        {(Boolean(submitError) || isPending || isConnected || isDisconnected) && (
          <div style={{ maxWidth: 700 }}>
            {submitError && <Alert severity="error" title={submitError} />}
            {isPending && (
              <Alert
                severity="warning"
                title={t('provisioning.connection.pending-title', 'Connecting')}
                action={
                  isAuthorizing ? (
                    <Button variant="secondary" onClick={cancelAuthorization}>
                      {t('provisioning.oauth-authorization.cancel-button', 'Cancel authorization')}
                    </Button>
                  ) : undefined
                }
              >
                <Stack alignItems="center" gap={1}>
                  <Spinner size="sm" inline />
                  <Trans i18nKey="provisioning.connection.pending-message">
                    Waiting for authorization and the connection check to finish.
                  </Trans>
                </Stack>
              </Alert>
            )}
            {isConnected && (
              <Alert severity="success" title={t('provisioning.connection.connected-title', 'Connected')} />
            )}
            {isDisconnected && (
              <Alert
                severity="error"
                title={t('provisioning.connection.disconnected-title', 'Disconnected')}
                action={
                  isOAuthConnectionType(data?.spec?.type) && selectedTypeAvailable ? (
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
                    const type = toConnectionType(option.value, selectedKind);
                    const fallbackType = PROVIDER_OPTIONS.find(({ value }) => value === option.value)?.types.find(
                      (type) => availableTypes.includes(type)
                    );
                    setValue('type', availableTypes.includes(type) ? type : (fallbackType ?? type), {
                      shouldDirty: true,
                    });
                  }
                }}
              />
            </Field>

            <ConnectionBaseFields required={!isEdit} type={selectedType} />

            {(selectedProvider === 'github' || selectedProvider === 'githubEnterprise') && (
              <Field noMargin label={t('provisioning.wizard.github-app-kind-label', 'App type')}>
                <RadioButtonGroup<'app' | 'oauth'>
                  disabled={isEdit}
                  options={kindOptions}
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
              type={selectedType}
              registration={register('webhookDisabled')}
              invalid={!!errors.webhookDisabled}
              error={errors.webhookDisabled?.message}
            />

            <Stack gap={2}>
              <Button type="submit" disabled={request.isLoading || isAuthorizing || !selectedTypeAvailable}>
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
