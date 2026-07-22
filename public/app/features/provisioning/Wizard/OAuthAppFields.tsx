import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Combobox, Field, Stack, TextLink } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';

import { ConnectionStatusBadge } from '../Connection/ConnectionStatusBadge';
import { OAuthAppInstruction } from '../components/Shared/OAuthAppInstruction';
import { CONNECTIONS_URL } from '../constants';
import { useConnectionOptions } from '../hooks/useConnectionOptions';
import { useConnectionStatus } from '../hooks/useConnectionStatus';
import { type OAuthConnectionType } from '../types';

import { type WizardFormData } from './types';

interface OAuthAppFieldsProps {
  connectionType: OAuthConnectionType;
}

export function OAuthAppFields({ connectionType }: OAuthAppFieldsProps) {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const {
    options: connectionOptions,
    isLoading,
    connections,
    error: connectionListError,
  } = useConnectionOptions(true, connectionType);

  const connectionName = watch('githubApp.connectionName');
  const { connection: selectedConnection } = useConnectionStatus(connectionName);

  return (
    <Stack direction="column" gap={2}>
      <OAuthAppInstruction type={connectionType} />

      {connectionListError ? (
        <Alert severity="error" title={t('provisioning.wizard.oauth-app-error-loading', 'Failed to load connections')}>
          {extractErrorMessage(connectionListError)}
        </Alert>
      ) : null}

      {!isLoading && !connectionListError && connections.length === 0 && (
        <Alert severity="info" title={t('provisioning.wizard.oauth-app-no-connections', 'No connections found')}>
          <Trans i18nKey="provisioning.wizard.oauth-app-no-connections-message">
            You don&apos;t have any connections for this provider yet.{' '}
            <TextLink href={`${CONNECTIONS_URL}/new`}>Create a connection</TextLink> and authorize the OAuth app, then
            come back here.
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
          <Controller
            name="githubApp.connectionName"
            control={control}
            rules={{
              required: t('provisioning.wizard.oauth-app-error-required', 'Connection is required'),
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
                  placeholder={t('provisioning.wizard.oauth-app-select-connection', 'Select a connection')}
                />

                {selectedConnection && (
                  <Stack>
                    <Trans i18nKey="provisioning.wizard.oauth-app-connection-status">Connection status:</Trans>
                    <ConnectionStatusBadge status={selectedConnection.status} />
                  </Stack>
                )}
              </Stack>
            )}
          />
        </Field>
      )}
    </Stack>
  );
}
