import { useCallback, useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
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
import { useOAuthAuthorizeFlow } from '../hooks/useOAuthAuthorizeFlow';
import { type ConnectionFormData } from '../types';
import { connectionFormToSpec, connectionToFormData } from '../utils/connectionData';
import { isOAuthConnectionType } from '../utils/connectionOAuth';
import { extractFormErrors, getConnectionFormErrors, setConnectionFormErrors } from '../utils/getFormErrors';

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
    defaultValues: connectionToFormData(data),
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

  const [justAuthorized, setJustAuthorized] = useState(false);
  const [authorizeName, setAuthorizeName] = useState<string>();
  const { authorize, cancelAuthorization, pendingName, authorizeError } = useOAuthAuthorizeFlow(
    useCallback(
      (name: string) => {
        setJustAuthorized(true);
        setAuthorizeName(undefined);
        // use timeout to let the redirect blocker disarm before navigating
        setTimeout(() => navigate(`${CONNECTIONS_URL}/${name}/edit`), 300);
      },
      [navigate]
    )
  );

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
    !justAuthorized &&
    !authorizeName &&
    !pendingName &&
    isEdit &&
    isOAuthConnectionType(data?.spec?.type) &&
    Boolean(
      data?.status?.conditions?.some(
        (c) => c.type === 'Ready' && c.status === 'False' && c.reason === 'AuthenticationFailed'
      )
    );

  const handleAuthorize = (name: string) => {
    const formData = getValues();
    if (formData.clientID && isOAuthConnectionType(formData.type)) {
      authorize(formData.type, formData.clientID, name, formData.serverUrl);
    }
  };

  const onSubmit = async (form: ConnectionFormData) => {
    setSubmitError(undefined);
    try {
      const result = await submitData(connectionFormToSpec(form), form.privateKey, form.clientSecret);
      if (result.error) {
        handleSubmitError(result.error);
        return;
      }

      reportInteraction('grafana_provisioning_connection_saved', {
        connectionName: connectionName ?? 'unknown',
        connectionType: form.type,
      });

      reset(form);

      // OAuth app connections need the user to authorize the app before tokens can be issued
      if (isOAuthConnectionType(form.type)) {
        const credentialsChanged =
          !isEdit || Boolean(form.clientSecret) || form.clientID !== data?.spec?.oauth?.clientID;
        const name = connectionName ?? result.data?.metadata?.name;
        if (credentialsChanged && name && form.clientID) {
          setAuthorizeName(name);
          authorize(form.type, form.clientID, name, form.serverUrl);
          return;
        }
      }

      // use timeout to ensure the form resets before navigating
      setTimeout(() => navigate(CONNECTIONS_TAB_URL), 300);
    } catch (err) {
      handleSubmitError(err);
    }
  };

  const handleSubmitError = (err: unknown) => {
    if (setConnectionFormErrors(err, setError)) {
      return;
    }

    if (isFetchError(err)) {
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
  };

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 700 }}>
        <FormPrompt onDiscard={reset} confirmRedirect={isDirty || Boolean(authorizeName) || Boolean(pendingName)} />
        <Stack direction="column" gap={2}>
          {submitError && <Alert severity="error" title={submitError} />}
          {authorizeError !== undefined && (
            <Alert severity="error" title={t('provisioning.connection-form.authorize-failed', 'Authorization failed')}>
              {authorizeError && <div>{authorizeError}</div>}
              <Trans i18nKey="provisioning.connection-form.authorize-failed-hint">
                Check the client ID and client secret, then try again.
              </Trans>
            </Alert>
          )}
          {authorizeName && !pendingName && (
            <Alert
              severity="info"
              title={t('provisioning.connection-form.authorize-title', 'Authorization required')}
              buttonContent={t('provisioning.connection-form.authorize-button', 'Authorize')}
              onRemove={() => handleAuthorize(authorizeName)}
            >
              {t('provisioning.connection-form.authorize-body', 'Connection saved. Authorize the app to grant access.')}
            </Alert>
          )}
          {pendingName && (
            <Alert
              severity="info"
              title={t(
                'provisioning.connection-form.authorize-waiting',
                'Waiting for authorization in the other tab...'
              )}
              buttonContent={t('provisioning.connection-form.authorize-waiting-cancel', 'Cancel')}
              onRemove={cancelAuthorization}
            />
          )}
          {needsReauthorization && connectionName && (
            <Alert
              severity="warning"
              title={t('provisioning.connection-form.reauthorize-title', 'Authorization expired')}
              buttonContent={t('provisioning.connection-form.reauthorize-button', 'Reauthorize')}
              onRemove={() => handleAuthorize(connectionName)}
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

          {!isOAuthConnectionType(selectedType) && (
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
