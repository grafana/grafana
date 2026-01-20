import { forwardRef, useImperativeHandle } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Field, RadioButtonGroup, Spinner, Stack } from '@grafana/ui';
import { ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

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
  const { control, watch } = useFormContext<WizardFormData>();

  // GH app form
  const credentialForm = useForm<ConnectionFormData>({
    defaultValues: {
      type: 'github',
      appID: '',
      installationID: '',
      privateKey: '',
    },
  });

  const [createConnection] = useCreateOrUpdateConnection();
  const [connections, isLoading, connectionListError] = useConnectionList({});

  const githubAppMode = watch('githubAppMode');
  const githubConnections = connections?.filter((c) => c.spec?.type === 'github') ?? [];

  // Expose submit method to parent via ref. The parent wizard (ProvisioningWizard) needs to trigger
  // submission when the user clicks "Next", so we use useImperativeHandle to allow the parent to
  // call submit() programmatically via githubAppStepRef.current?.submit()
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
        if (result.data?.metadata?.name) {
          onSubmit({ success: true, connectionName: result.data.metadata.name });
        } else {
          const errorMessage = result.error ? extractErrorMessage(result.error) : defaultErrorMessage;
          onSubmit({ success: false, error: errorMessage });
        }
      } catch (error) {
        onSubmit({ success: false, error: extractErrorMessage(error) });
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

      {githubAppMode === 'existing' && (
        <Stack direction="column" gap={2}>
          {isLoading ? (
            <Spinner />
          ) : connectionListError ? (
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
                  t('provisioning.wizard.github-app-error-required', 'This field is required'),
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
                        onClick={() => onChange(connectionName)}
                      />
                    );
                  })}
                </Stack>
              )}
            />
          )}
        </Stack>
      )}

      {githubAppMode === 'new' && (
        <FormProvider {...credentialForm}>
          <GitHubAppCredentialFields required />
        </FormProvider>
      )}
    </Stack>
  );
});
