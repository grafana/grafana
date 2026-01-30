import { forwardRef, useImperativeHandle } from 'react';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Field, RadioButtonGroup, Spinner, Stack } from '@grafana/ui';
import { ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage } from 'app/api/utils';

import { ConnectionListItem } from '../Connection/ConnectionListItem';
import { GitHubConnectionFields } from '../components/Shared/GitHubConnectionFields';
import { useConnectionList } from '../hooks/useConnectionList';
import { useCreateOrUpdateConnection } from '../hooks/useCreateOrUpdateConnection';
import { ConnectionFormData } from '../types';
import { getConnectionFormErrors } from '../utils/getFormErrors';

import { GithubAppStepInstruction } from './components/GithubAppStepInstruction';
import { ConnectionCreationResult, WizardFormData } from './types';

export interface GitHubAppStepRef {
  submit: () => Promise<void>;
}

interface GitHubAppStepProps {
  onSubmit: (result: ConnectionCreationResult) => void;
}

export const GitHubAppStep = forwardRef<GitHubAppStepRef | null, GitHubAppStepProps>(function GitHubAppStep(
  { onSubmit },
  ref
) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

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
  const [connections, isLoading, connectionListError] = useConnectionList({});

  const githubAppMode = watch('githubAppMode');
  const githubConnections = connections?.filter((c) => c.spec?.type === 'github') ?? [];

  // Expose submit method to parent via ref. The parent wizard (ProvisioningWizard) needs to trigger
  // submission when the user clicks "Next", so we use useImperativeHandle to allow the parent to
  // call submit() programmatically via githubAppStepRef.current?.submit()
  useImperativeHandle(
    ref,
    () => ({
      submit: async () => {
        const isValid = await credentialForm.trigger();
        if (!isValid) {
          const validationError = t(
            'provisioning.wizard.github-app-creation-default-error',
            'Failed to create connection'
          );
          onSubmit({ success: false, error: validationError });
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

        try {
          const result = await createConnection(spec, privateKey);
          if (result.data?.metadata?.name) {
            onSubmit({ success: true, connectionName: result.data.metadata.name });
          } else if (result.error) {
            if (handleFormErrors(result.error)) {
              return;
            }
            onSubmit({ success: false, error: extractErrorMessage(result.error) });
          } else {
            onSubmit({ success: false, error: defaultErrorMessage });
          }
        } catch (error) {
          if (handleFormErrors(error)) {
            return;
          }
          onSubmit({ success: false, error: extractErrorMessage(error) });
        }
      },
    }),
    [credentialForm, createConnection, onSubmit]
  );

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
                  t('provisioning.wizard.github-app-error-required', 'Connection is required'),
              }}
              render={({ field: { onChange, value } }) => (
                <Stack direction="column" gap={1}>
                  {githubConnections.map((connection) => {
                    const connectionName = connection.metadata?.name ?? '';
                    return (
                      <ConnectionListItem
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
          <GitHubConnectionFields required />
        </FormProvider>
      )}
    </Stack>
  );
});
