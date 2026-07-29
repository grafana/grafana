import { css } from '@emotion/css';
import { useEffect } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Field, RadioButtonGroup, Stack, useStyles2 } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';

import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { WebhookDisabledField } from '../components/Shared/WebhookDisabledField';
import { useConnectionOptions } from '../hooks/useConnectionOptions';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { type ConnectionFormData } from '../types';
import { connectionFormToSpec, getDefaultConnectionFormData } from '../utils/connectionData';
import { setConnectionFormErrors } from '../utils/getFormErrors';

import { NewOAuthConnectionFields } from './NewOAuthConnectionFields';
import { useStepStatus } from './StepStatusContext';
import { ConnectionSelect } from './components/ConnectionSelect';
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

  // GH app form
  const credentialForm = useForm<ConnectionFormData>({
    defaultValues: getDefaultConnectionFormData(connectionType),
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

  const [githubAppMode, githubAppKind = 'app'] = watch(['githubAppMode', 'githubAppKind']);

  const handleCreateConnection = async () => {
    // Reset any existing step errors
    setStepStatusInfo({ status: 'idle' });
    const defaultErrorMessage = t(
      'provisioning.wizard.github-app-creation-default-error',
      'Failed to create connection'
    );
    const isValid = await credentialForm.trigger();
    if (!isValid) {
      onGitHubAppSubmit({ success: false, error: defaultErrorMessage });
      return;
    }

    const form = credentialForm.getValues();

    try {
      const result = await createConnection(connectionFormToSpec(form), form.privateKey);
      if (result.data?.metadata?.name) {
        credentialForm.reset();
        onGitHubAppSubmit({ success: true, connectionName: result.data.metadata.name });
        return;
      } else if (result.error) {
        if (setConnectionFormErrors(result.error, credentialForm.setError)) {
          return;
        }
        onGitHubAppSubmit({ success: false, error: extractErrorMessage(result.error) || defaultErrorMessage });
      }
    } catch (error) {
      if (setConnectionFormErrors(error, credentialForm.setError)) {
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
            <ConnectionSelect
              options={connectionOptions}
              isLoading={isLoading}
              placeholder={t('provisioning.wizard.github-app-select-connection', 'Select a GitHub App connection')}
            />
          )}
        </Stack>
      )}

      {githubAppMode === 'new' && (
        <>
          <Field noMargin label={t('provisioning.wizard.github-app-kind-label', 'App type')}>
            <Controller
              name="githubAppKind"
              control={control}
              render={({ field: { ref, onChange, value, ...field } }) => (
                <RadioButtonGroup
                  options={[
                    { value: 'app', label: t('provisioning.wizard.github-app-kind-app', 'GitHub App') },
                    { value: 'oauth', label: t('provisioning.wizard.github-app-kind-oauth', 'OAuth App') },
                  ]}
                  value={value ?? 'app'}
                  onChange={onChange}
                  {...field}
                />
              )}
            />
          </Field>

          {githubAppKind === 'oauth' ? (
            <NewOAuthConnectionFields
              type={connectionType === 'githubEnterprise' ? 'githubEnterpriseOAuth' : 'githubOAuth'}
              onAuthorized={(name) => onGitHubAppSubmit({ success: true, connectionName: name })}
            />
          ) : (
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
        </>
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
