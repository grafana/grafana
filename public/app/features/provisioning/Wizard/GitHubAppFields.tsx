import { useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Combobox, Field, RadioButtonGroup, Stack } from '@grafana/ui';
import { ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { ConnectionStatusBadge } from '../Connection/ConnectionStatusBadge';
import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { useConnectionOptions } from '../hooks/useConnectionOptions';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { ConnectionFormData } from '../types';
import { getConnectionFormErrors } from '../utils/getFormErrors';

import { useStepStatus } from './StepStatusContext';
import { GithubAppStepInstruction } from './components/GithubAppStepInstruction';
import { ConnectionCreationResult, WizardFormData } from './types';

interface GitHubAppFieldsProps {
  onGitHubAppSubmit: (result: ConnectionCreationResult) => void;
}

export function GitHubAppFields({ onGitHubAppSubmit }: GitHubAppFieldsProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const { setStepStatusInfo } = useStepStatus();

  // GH app form
  const credentialForm = useForm<ConnectionFormData>({
    defaultValues: {
      type: 'github',
      title: '',
      description: '',
      appID: '',
      installationID: '',
      privateKey: '',
    },
  });

  const [createConnection] = useCreateOrUpdateConnection();
  const {
    options: connectionOptions,
    isLoading,
    connections: githubConnections,
    error: connectionListError,
  } = useConnectionOptions(true);

  const [githubAppMode, githubAppConnectionName] = watch(['githubAppMode', 'githubApp.connectionName']);
  const { connection: selectedConnection } = useConnectionStatus(githubAppConnectionName);
  const [isCreatingConnection, setIsCreatingConnection] = useState(false);

  const handleCreateConnection = async () => {
    // Reset any existing step errors
    setStepStatusInfo({ status: 'idle' });
    const isValid = await credentialForm.trigger();
    if (!isValid) {
      const validationError = t('provisioning.wizard.github-app-creation-default-error', 'Failed to create connection');
      onGitHubAppSubmit({ success: false, error: validationError });
      return;
    }

    const { title, description, appID, installationID, privateKey } = credentialForm.getValues();
    const spec: ConnectionSpec = {
      type: 'github',
      title,
      ...(description && { description }),
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

    setIsCreatingConnection(true);
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
    } finally {
      setIsCreatingConnection(false);
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
            onNewConnectionCreation={handleCreateConnection}
            isCreating={isCreatingConnection}
          />
        </FormProvider>
      )}
    </Stack>
  );
}
