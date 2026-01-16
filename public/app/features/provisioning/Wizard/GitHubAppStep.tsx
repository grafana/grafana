import { memo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Field, Input, RadioButtonGroup, SecretTextArea, Spinner, Stack, Text } from '@grafana/ui';

import { useConnectionList } from '../hooks/useConnectionList';

import { SelectableConnectionCard } from './SelectableConnectionCard';
import { WizardFormData } from './types';

export const GitHubAppStep = memo(function GitHubAppStep() {
  const modeOptions = [
    {
      value: 'existing',
      label: t('provisioning.wizard.github-app-mode-existing', 'Choose one of the existing app'),
    },
    {
      value: 'new',
      label: t('provisioning.wizard.github-app-mode-new', 'Connect to a new app'),
    },
  ];
  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<WizardFormData>();

  const [connections, isLoading, error] = useConnectionList({});
  const [privateKeyConfigured, setPrivateKeyConfigured] = useState(false);

  const githubAppMode = watch('githubAppMode');

  // Filter to only GitHub connections
  const githubConnections = connections?.filter((c) => c.spec?.type === 'github') ?? [];

  return (
    <Stack direction="column" gap={2}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="provisioning.wizard.github-app-subtitle">
          Create a GitHub APP following this{' '}
          <a href="https://github.com/settings/apps/new" target="_blank" rel="noopener noreferrer">
            documentation
          </a>{' '}
          and then follow the instructions in the{' '}
          <a
            href="https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana-application-integrations/git-integration/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Grafana Docs
          </a>{' '}
          to authenticate. Make sure the App had the following permissions
        </Trans>
      </Text>

      <Stack direction="column" gap={0.5}>
        <Text variant="bodySmall">
          <Trans i18nKey="provisioning.wizard.github-app-permissions-content">Content: Read and write</Trans>
        </Text>
        <Text variant="bodySmall">
          <Trans i18nKey="provisioning.wizard.github-app-permissions-metadata">Metadata: Read only</Trans>
        </Text>
        <Text variant="bodySmall">
          <Trans i18nKey="provisioning.wizard.github-app-permissions-prs">Pull requests: Read and write</Trans>
        </Text>
        <Text variant="bodySmall">
          <Trans i18nKey="provisioning.wizard.github-app-permissions-webhooks">Webhooks: Read and write</Trans>
        </Text>
      </Stack>

      <Field noMargin label={t('provisioning.wizard.github-app-mode-label', 'GitHub App configuration')}>
        <Controller
          name="githubAppMode"
          control={control}
          render={({ field: { ref, onChange, ...field } }) => (
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
                  githubAppMode === 'existing'
                    ? t('provisioning.wizard.github-app-error-required', 'Please select a connection')
                    : false,
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
        <Stack direction="column" gap={2}>
          <Field
            noMargin
            label={t('provisioning.wizard.github-app-label-app-id', 'App id')}
            description={t(
              'provisioning.wizard.github-app-description-app-id',
              'Paste here the App id for your GitHub App'
            )}
            invalid={!!errors?.githubApp?.appID}
            error={errors?.githubApp?.appID?.message}
            required
          >
            <Input
              id="githubApp.appID"
              {...register('githubApp.appID', {
                required:
                  githubAppMode === 'new'
                    ? t('provisioning.wizard.github-app-error-required', 'This field is required')
                    : false,
              })}
              placeholder={t('provisioning.wizard.github-app-placeholder-app-id', 'github_appid_hjiahjdlsj')}
            />
          </Field>

          <Field
            noMargin
            label={t('provisioning.wizard.github-app-label-installation-id', 'App Installation ID')}
            description={t(
              'provisioning.wizard.github-app-description-installation-id',
              'Paste the installation id of your GitHub App'
            )}
            invalid={!!errors?.githubApp?.installationID}
            error={errors?.githubApp?.installationID?.message}
            required
          >
            <Input
              id="githubApp.installationID"
              {...register('githubApp.installationID', {
                required:
                  githubAppMode === 'new'
                    ? t('provisioning.wizard.github-app-error-required', 'This field is required')
                    : false,
              })}
              placeholder={t(
                'provisioning.wizard.github-app-placeholder-installation-id',
                'github_installationid_1234'
              )}
            />
          </Field>

          <Field
            noMargin
            htmlFor="githubApp.privateKey"
            label={t('provisioning.wizard.github-app-label-private-key', 'Private key')}
            description={t(
              'provisioning.wizard.github-app-description-private-key',
              'Paste here the private key to access the installation'
            )}
            invalid={!!errors?.githubApp?.privateKey}
            error={errors?.githubApp?.privateKey?.message}
            required
          >
            <Controller
              name="githubApp.privateKey"
              control={control}
              rules={{
                required:
                  githubAppMode === 'new'
                    ? t('provisioning.wizard.github-app-error-required', 'This field is required')
                    : false,
              }}
              render={({ field: { ref, ...field } }) => (
                <SecretTextArea
                  {...field}
                  id="githubApp.privateKey"
                  placeholder={t('provisioning.wizard.github-app-placeholder-private-key', '173847hjgdflfsdkjiq290')}
                  isConfigured={privateKeyConfigured}
                  onReset={() => {
                    setValue('githubApp.privateKey', '');
                    setPrivateKeyConfigured(false);
                  }}
                  rows={8}
                  grow
                />
              )}
            />
          </Field>
        </Stack>
      )}
    </Stack>
  );
});
