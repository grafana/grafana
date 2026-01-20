import { forwardRef, useImperativeHandle, useState } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { isFetchError, reportInteraction } from '@grafana/runtime';
import { Alert, Field, RadioButtonGroup, Spinner, Stack, Text } from '@grafana/ui';
import { ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';

import { GitHubAppCredentialFields } from '../components/Shared/GitHubAppCredentialFields';
import { useConnectionList } from '../hooks/useConnectionList';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { ConnectionFormData } from '../types';

import { SelectableConnectionCard } from './SelectableConnectionCard';
import { WizardFormData } from './types';

export interface GitHubAppStepRef {
  submit: () => Promise<void>;
}

interface GitHubAppStepProps {
  onSubmit: (result: { success: true; connectionName: string } | { success: false; error: string }) => void;
}

export const GitHubAppStep = forwardRef<GitHubAppStepRef, GitHubAppStepProps>(function GitHubAppStep(
  { onSubmit },
  ref
) {
  const modeOptions = [
    {
      value: 'existing',
      label: t('provisioning.wizard.github-app-mode-existing', 'Choose an existing app'),
    },
    {
      value: 'new',
      label: t('provisioning.wizard.github-app-mode-new', 'Connect to a new app'),
    },
  ];

  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  // Local form for credential fields when creating a new connection
  const credentialForm = useForm<ConnectionFormData>({
    defaultValues: {
      type: 'github',
      appID: '',
      installationID: '',
      privateKey: '',
    },
  });

  const [createConnection] = useCreateOrUpdateConnection();
  const [connections, isLoading, error] = useConnectionList({});
  const [privateKeyConfigured, setPrivateKeyConfigured] = useState(false);

  const githubAppMode = watch('githubAppMode');

  // Filter to only GitHub connections
  const githubConnections = connections?.filter((c) => c.spec?.type === 'github') ?? [];

  // Expose submit method to parent
  useImperativeHandle(ref, () => ({
    submit: async () => {
      const isValid = await credentialForm.trigger();
      if (!isValid) {
        return;
      }

      const { appID, installationID, privateKey } = credentialForm.getValues();
      const spec: ConnectionSpec = {
        type: 'github',
        github: { appID, installationID },
      };

      const defaultErrorMessage = t(
        'provisioning.wizard.github-app-creation-default-error',
        'Failed to create connection'
      );

      try {
        const result = await createConnection(spec, privateKey);
        if (result.error) {
          const message = isFetchError(result.error)
            ? result.error.data?.message || defaultErrorMessage
            : defaultErrorMessage;
          onSubmit({ success: false, error: message });
        } else if (result.data) {
          onSubmit({ success: true, connectionName: result.data.metadata?.name || '' });
        } else {
          onSubmit({ success: false, error: defaultErrorMessage });
        }
      } catch (error) {
        const message = isFetchError(error)
          ? error.data?.message || defaultErrorMessage
          : defaultErrorMessage;
        onSubmit({ success: false, error: message });
      }
    },
  }));

  return (
    <Stack direction="column" gap={2}>
      <Field noMargin label={t('provisioning.wizard.github-app-mode-label', 'GitHub App configuration')}>
        <Controller
          name="githubAppMode"
          control={control}
          render={({ field: { ref: fieldRef, onChange, ...field } }) => (
            <RadioButtonGroup
              options={modeOptions}
              onChange={(value) => {
                onChange(value);
                reportInteraction('grafana_provisioning_wizard_github_app_mode_selected', {
                  mode: value,
                });
              }}
              {...field}
            />
          )}
        />
      </Field>

      {githubAppMode === 'existing' && (
        <Stack direction="column" gap={2}>
          {isLoading ? (
            <Spinner />
          ) : error ? (
            <Alert
              severity="error"
              title={t('provisioning.wizard.github-app-error-loading', 'Failed to load connections')}
            >
              {error instanceof Error ? error.message : String(error)}
            </Alert>
          ) : null}
          {!isLoading && !error && githubConnections.length === 0 && (
            <Alert
              severity="info"
              title={t('provisioning.wizard.github-app-no-connections', 'No GitHub connections found')}
            >
              <Trans i18nKey="provisioning.wizard.github-app-no-connections-message">
                You don&apos;t have any existing GitHub app connections. Please select &quot;Connect to a new
                app&quot; to create one.
              </Trans>
            </Alert>
          )}
          {githubConnections.length > 0 && (
            <Controller
              name="githubApp.connectionName"
              control={control}
              rules={{
                required: githubAppMode === 'existing' && t('provisioning.wizard.github-app-error-required', 'This field is required'),
              }}
              render={({ field: { onChange, value } }) => (
                <Stack direction="column" gap={1}>
                  {githubConnections.map((connection) => {
                    const connectionName = connection.metadata?.name ?? '';
                    return (
                      <SelectableConnectionCard
                        key={connectionName}
                        connection={connection}
                        isSelected={value === connectionName}
                        onClick={() => {
                          onChange(connectionName);
                          reportInteraction('grafana_provisioning_wizard_github_app_selected', {
                            connectionName,
                          });
                        }}
                      />
                    );
                  })}
                </Stack>
              )}
            />
          )}
          {errors?.githubApp?.connectionName?.message && (
            <Text color="error">{errors.githubApp.connectionName.message}</Text>
          )}
        </Stack>
      )}

      {githubAppMode === 'new' && (
        <FormProvider {...credentialForm}>
          <GitHubAppCredentialFields
            required
            privateKeyConfigured={privateKeyConfigured}
            onPrivateKeyReset={() => {
              setPrivateKeyConfigured(false);
            }}
          />
        </FormProvider>
      )}
    </Stack>
  );
});
