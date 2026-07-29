import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Field, RadioButtonGroup, Stack } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';

import { useConnectionOptions } from '../hooks/useConnectionOptions';
import { type OAuthConnectionType } from '../types';

import { NewOAuthConnectionFields } from './NewOAuthConnectionFields';
import { ConnectionSelect } from './components/ConnectionSelect';
import { type WizardFormData } from './types';

interface OAuthAppFieldsProps {
  connectionType: OAuthConnectionType;
}

export function OAuthAppFields({ connectionType }: OAuthAppFieldsProps) {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WizardFormData>();

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
      <Field noMargin label={t('provisioning.wizard.oauth-app-mode-label', 'OAuth App configuration')}>
        <Controller
          name="githubAppMode"
          control={control}
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

      {mode === 'new' && (
        <NewOAuthConnectionFields
          type={connectionType}
          onAuthorized={(name) => {
            setValue('githubApp.connectionName', name);
            setValue('githubAppMode', 'existing');
          }}
        />
      )}

      {mode === 'existing' && connectionListError ? (
        <Alert severity="error" title={t('provisioning.wizard.oauth-app-error-loading', 'Failed to load connections')}>
          {extractErrorMessage(connectionListError)}
        </Alert>
      ) : null}

      {mode === 'existing' && hasNoConnections && (
        <Alert severity="info" title={t('provisioning.wizard.oauth-app-no-connections', 'No connections found')}>
          <Trans i18nKey="provisioning.wizard.oauth-app-no-connections-message">
            You don&apos;t have any connections for this provider yet. Please select &quot;Connect to a new app&quot; to
            create one.
          </Trans>
        </Alert>
      )}

      {mode === 'existing' && connections.length > 0 && (
        <Field
          noMargin
          label={t('provisioning.wizard.oauth-app-connection-label', 'Connection')}
          error={errors?.githubApp?.connectionName?.message}
          invalid={Boolean(errors?.githubApp?.connectionName?.message)}
        >
          <ConnectionSelect
            options={connectionOptions}
            isLoading={isLoading}
            placeholder={t('provisioning.wizard.oauth-app-select-connection', 'Select a connection')}
          />
        </Field>
      )}
    </Stack>
  );
}
