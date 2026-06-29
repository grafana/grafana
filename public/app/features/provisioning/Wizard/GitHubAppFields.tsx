import { css } from '@emotion/css';
import { useEffect } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Combobox, Field, RadioButtonGroup, Stack, useStyles2 } from '@grafana/ui';
import { type ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { ConnectionStatusBadge } from '../Connection/ConnectionStatusBadge';
import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { useConnectionOptions } from '../hooks/useConnectionOptions';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { type ConnectionFormData } from '../types';
import { getConnectionFormErrors } from '../utils/getFormErrors';

import { useStepStatus } from './StepStatusContext';
import { GithubAppStepInstruction } from './components/GithubAppStepInstruction';
import { type ConnectionCreationResult, type GitHubBasedConnectionType, type WizardFormData } from './types';

interface GitHubAppFieldsProps {
  connectionType: GitHubBasedConnectionType;
  onGitHubAppSubmit: (result: ConnectionCreationResult) => void;
}

export function GitHubAppFields({ connectionType, onGitHubAppSubmit }: GitHubAppFieldsProps) {
  const styles = useStyles2(getStyles);
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WizardFormData>();
  const { setStepStatusInfo } = useStepStatus();

  const isGitHubEnterprise = connectionType === 'githubEnterprise';

  // GH app form
  const credentialForm = useForm<ConnectionFormData>({
    defaultValues: {
      type: connectionType,
      title: '',
      description: '',
      appID: '',
      installationID: '',
      privateKey: '',
      webhookDisabled: false,
      serverUrl: '',
    },
  });

  const [createConnection, connectionRequest] = useCreateOrUpdateConnection();
  const {
    options: connectionOptions,
    isLoading,
    connections: githubConnections,
    error: connectionListError,
  } = useConnectionOptions(true, connectionType);

  const hasNoConnections = !isLoading && !connectionListError && githubConnections.length === 0;

  useEffect(() => {
    if (hasNoConnections) {
      setValue('githubAppMode', 'new');
    }
  }, [hasNoConnections, setValue]);

  const [githubAppMode, githubAppConnectionName] = watch(['githubAppMode', 'githubApp.connectionName']);
  const { connection: selectedConnection } = useConnectionStatus(githubAppConnectionName);

  const handleCreateConnection = async () => {
    // Reset any existing step errors
    setStepStatusInfo({ status: 'idle' });
    const isValid = await credentialForm.trigger();
    if (!isValid) {
      const validationError = t('provisioning.wizard.github-app-creation-default-error', 'Failed to create connection');
      onGitHubAppSubmit({ success: false, error: validationError });
      return;
    }

    const { title, description, appID, installationID, privateKey, webhookDisabled, serverUrl } =
      credentialForm.getValues();
    const baseSpec = {
      title,
      ...(description && { description }),
      ...(webhookDisabled ? { webhook: { disabled: true } } : {}),
    };
    const spec: ConnectionSpec = isGitHubEnterprise
      ? {
          ...baseSpec,
          type: 'githubEnterprise',
          githubEnterprise: { appID, installationID, serverUrl },
        }
      : {
          ...baseSpec,
          type: 'github',
          github: { appID, installationID },
        };

    const defaultErrorMessage = t(
      'provisioning.wizard.github-app-creation-default-error',
      'Failed to create connection'
    );

    // Returns true if form errors were set (caller should return early)
    const handleFormErrors = (error: unknown): boolean => {
      if (isFetchError(error)) {
        const formErrors = getConnectionFormErrors(error.data);
        if (formErrors.length > 0) {
          for (const [field, errorMessage] of formErrors) {
            credentialForm.setError(field, errorMessage);
          }
          return true;
        }
      }
      return false;
    };

    try {
      const result = await createConnection(spec, privateKey);
      if (result.data?.metadata?.name) {
        credentialForm.reset();
        onGitHubAppSubmit({ success: true, connectionName: result.data.metadata.name });
        return;
      } else if (result.error) {
        if (handleFormErrors(result.error)) {
          return;
        }
        onGitHubAppSubmit({ success: false, error: extractErrorMessage(result.error) || defaultErrorMessage });
      }
    } catch (error) {
      if (handleFormErrors(error)) {
        return;
      }
      onGitHubAppSubmit({ success: false, error: extractErrorMessage(error) || defaultErrorMessage });
    }
  };

  return (
    <Stack direction="column" gap={2}>
      <GithubAppStepInstruction />
      <Field noMargin label={t('provisioning.wizard.github-app-mode-label', 'GitHub App configuration')}>
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

      {errors?.githubApp?.connectionName?.message && (
        <Alert severity="error" title={errors.githubApp.connectionName.message} />
      )}

      {githubAppMode === 'existing' && (
        <Stack direction="column" gap={2}>
          {connectionListError ? (
            <Alert
              severity="error"
              title={t('provisioning.wizard.github-app-error-loading', 'Failed to load connections')}
            >
              {extractErrorMessage(connectionListError)}
            </Alert>
          ) : null}
          {!isLoading && !connectionListError && githubConnections.length === 0 && (
            <Alert
              severity="info"
              title={t('provisioning.wizard.github-app-no-connections', 'No GitHub connections found')}
            >
              <Trans i18nKey="provisioning.wizard.github-app-no-connections-message">
                You don&apos;t have any existing GitHub app connections. Please select &quot;Connect to a new app&quot;
                to create one.
              </Trans>
            </Alert>
          )}
          {githubConnections.length > 0 && (
            <Controller
              name="githubApp.connectionName"
              control={control}
              rules={{
                required:
                  githubAppMode === 'existing' &&
                  t('provisioning.wizard.github-app-error-required', 'Connection is required'),
              }}
              render={({ field: { onChange, value } }) => (
                <Stack direction="column" gap={1}>
                  <Combobox
                    options={connectionOptions}
                    onChange={(option) => onChange(option?.value ?? '')}
                    value={value}
                    invalid={Boolean(errors?.githubApp?.connectionName?.message)}
                    loading={isLoading}
                    disabled={isLoading}
                    placeholder={t(
                      'provisioning.wizard.github-app-select-connection',
                      'Select a GitHub App connection'
                    )}
                  />

                  {selectedConnection && (
                    <Stack>
                      <Trans i18nKey="provisioning.wizard.github-app-connection-status">Connection status:</Trans>
                      <ConnectionStatusBadge status={selectedConnection.status} />
                    </Stack>
                  )}
                </Stack>
              )}
            />
          )}
        </Stack>
      )}

      {githubAppMode === 'new' && (
        <FormProvider {...credentialForm}>
          <GitHubConnectionFields
            required
            type={connectionType}
            onNewConnectionCreation={handleCreateConnection}
            isCreating={connectionRequest.isLoading}
          />
          <WebhookDisabledField
            registration={credentialForm.register('webhookDisabled')}
            invalid={!!credentialForm.formState.errors.webhookDisabled}
            error={credentialForm.formState.errors.webhookDisabled?.message}
          />
        </FormProvider>
      )}
    </Stack>
  );
}

const getStyles = (_theme: GrafanaTheme2) => ({
  appModeRadios: css({
    maxWidth: '100%',
    overflowX: 'auto',
  }),
});
