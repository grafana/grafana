import { css } from '@emotion/css';
import { useEffect } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Field, RadioButtonGroup, Stack, useStyles2 } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';

import { AppInstruction } from '../components/Shared/AppInstruction';
import { AuthorizationPendingAlert } from '../components/Shared/AuthorizationPendingAlert';
import { ConnectionBaseFields } from '../components/Shared/ConnectionBaseFields';
import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { OAuthConnectionFields } from '../components/Shared/OAuthConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { useConnectionOptions } from '../hooks/useConnectionOptions';
import { useSaveConnection } from '../hooks/useSaveConnection';
import { type ConnectionFormData } from '../types';
import { type ConnectionProvider, getConnectionFormDefaults, toConnectionType } from '../utils/connectionData';
import { isOAuthConnectionType } from '../utils/connectionOAuth';

import { useStepStatus } from './StepStatusContext';
import { ConnectionSelect } from './components/ConnectionSelect';
import { type ConnectionCreationResult, type WizardFormData } from './types';

interface AppConnectionFieldsProps {
  provider: ConnectionProvider;
  kind: 'app' | 'oauth';
  onGitHubAppSubmit: (result: ConnectionCreationResult) => void;
}

export function AppConnectionFields({ provider, kind, onGitHubAppSubmit }: AppConnectionFieldsProps) {
  const styles = useStyles2(getStyles);
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const connectionType = toConnectionType(provider, kind);
  const {
    options: connectionOptions,
    isLoading,
    connections,
    error: connectionListError,
  } = useConnectionOptions(true, connectionType);

  const hasNoConnections = !isLoading && !connectionListError && connections.length === 0;

  useEffect(() => {
    if (hasNoConnections) {
      setValue('githubAppMode', 'new');
    }
  }, [hasNoConnections, setValue]);

  const mode = watch('githubAppMode');

  return (
    <Stack direction="column" gap={2}>
      <Field noMargin label={t('provisioning.wizard.app-mode-label', 'App configuration')}>
        <Controller
          name="githubAppMode"
          control={control}
          // RadioButtonGroup doesn't support refs, so we need to remove it from fields
          render={({ field: { ref, onChange, ...field } }) => (
            <RadioButtonGroup
              className={styles.appModeRadios}
              options={[
                {
                  value: 'existing',
                  label: t('provisioning.wizard.github-app-mode-existing', 'Choose an existing app'),
                },
                {
                  value: 'new',
                  label: t('provisioning.wizard.github-app-mode-new', 'Connect to a new app'),
                },
              ]}
              onChange={onChange}
              {...field}
            />
          )}
        />
      </Field>

      {mode === 'existing' && (
        <Stack direction="column" gap={2}>
          {connectionListError ? (
            <Alert
              severity="error"
              title={t('provisioning.wizard.github-app-error-loading', 'Failed to load connections')}
            >
              {extractErrorMessage(connectionListError)}
            </Alert>
          ) : null}
          {hasNoConnections && (
            <Alert severity="info" title={t('provisioning.wizard.oauth-app-no-connections', 'No connections found')}>
              <Trans i18nKey="provisioning.wizard.oauth-app-no-connections-message">
                You don&apos;t have any connections for this provider yet. Please select &quot;Connect to a new
                app&quot; to create one.
              </Trans>
            </Alert>
          )}
          {connections.length > 0 && (
            <Field
              noMargin
              label={t('provisioning.wizard.oauth-app-connection-label', 'Connection')}
              error={errors?.githubApp?.connectionName?.message}
              invalid={Boolean(errors?.githubApp?.connectionName?.message)}
            >
              <ConnectionSelect
                options={connectionOptions}
                isLoading={isLoading}
                placeholder={t('provisioning.wizard.select-connection', 'Select a connection')}
                required={t('provisioning.wizard.github-app-error-required', 'Connection is required')}
              />
            </Field>
          )}
        </Stack>
      )}

      {mode === 'new' && (
        <NewConnectionFields
          provider={provider}
          kind={kind}
          onGitHubAppSubmit={onGitHubAppSubmit}
          onAuthorized={(name) => onGitHubAppSubmit({ success: true, connectionName: name })}
        />
      )}
    </Stack>
  );
}

interface NewConnectionFieldsProps {
  provider: ConnectionProvider;
  kind: 'app' | 'oauth';
  onAuthorized: (connectionName: string) => void;
  /** Reports the creation result for the GitHub App kind */
  onGitHubAppSubmit?: (result: ConnectionCreationResult) => void;
}

function NewConnectionFields({ provider, kind, onAuthorized, onGitHubAppSubmit }: NewConnectionFieldsProps) {
  const type = toConnectionType(provider, kind);
  const credentialForm = useForm<ConnectionFormData>({
    defaultValues: getConnectionFormDefaults(type),
  });
  const { setStepStatusInfo } = useStepStatus();

  const { save, request, submitError, setSubmitError, isAuthorizing } = useSaveConnection(onAuthorized);

  const handleCreateGitHubApp = async () => {
    // Reset any existing step errors
    setStepStatusInfo({ status: 'idle' });
    const defaultErrorMessage = t(
      'provisioning.wizard.github-app-creation-default-error',
      'Failed to create connection'
    );
    if (!(await credentialForm.trigger())) {
      onGitHubAppSubmit?.({ success: false, error: defaultErrorMessage });
      return;
    }

    const result = await save({
      form: credentialForm.getValues(),
      authorize: false,
      setError: credentialForm.setError,
    });
    if (result.status === 'saved') {
      credentialForm.reset();
      onGitHubAppSubmit?.({ success: true, connectionName: result.name });
      return;
    }
    if (result.status === 'error' && !result.fieldErrors) {
      onGitHubAppSubmit?.({ success: false, error: result.message || defaultErrorMessage });
    }
  };

  const handleCreateOAuthApp = async () => {
    const result = await save({
      form: credentialForm.getValues(),
      authorize: true,
      setError: credentialForm.setError,
      validate: () => credentialForm.trigger(),
    });
    if (result.status === 'error' && !result.fieldErrors) {
      setSubmitError(
        result.message || t('provisioning.wizard.oauth-app-creation-default-error', 'Failed to create connection')
      );
    }
  };

  return (
    <FormProvider {...credentialForm}>
      <Stack direction="column" gap={2}>
        {isAuthorizing && <AuthorizationPendingAlert />}
        {submitError && <Alert severity="error" title={submitError} />}

        <AppInstruction type={type} />
        <ConnectionBaseFields required type={type} />

        {isOAuthConnectionType(type) ? (
          <OAuthConnectionFields
            required
            type={type}
            onNewConnectionCreation={handleCreateOAuthApp}
            isCreating={request.isLoading}
          />
        ) : (
          <GitHubConnectionFields
            required
            onNewConnectionCreation={handleCreateGitHubApp}
            isCreating={request.isLoading}
          />
        )}

        <WebhookDisabledField
          registration={credentialForm.register('webhookDisabled')}
          invalid={!!credentialForm.formState.errors.webhookDisabled}
          error={credentialForm.formState.errors.webhookDisabled?.message}
        />
      </Stack>
    </FormProvider>
  );
}

const getStyles = (_theme: GrafanaTheme2) => ({
  appModeRadios: css({
    maxWidth: '100%',
    overflowX: 'auto',
  }),
});
