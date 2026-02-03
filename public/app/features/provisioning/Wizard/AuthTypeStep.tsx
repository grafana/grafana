import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, RadioButtonGroup, Stack } from '@grafana/ui';

import { useConnectionList } from '../hooks/useConnectionList';
import { isConnectionReady } from '../utils/connectionStatus';

import { GitHubAppFields } from './GitHubAppFields';
import { RepositoryField } from './components/RepositoryField';
import { RepositoryTokenInput } from './components/RepositoryTokenInput';
import { ConnectionCreationResult, GitHubAuthType, WizardFormData } from './types';

interface AuthTypeOption {
  id: GitHubAuthType;
  label: string;
  description: string;
  icon: 'key-skeleton-alt' | 'github';
}

interface AuthTypeStepProps {
  onGitHubAppSubmit: (result: ConnectionCreationResult) => void;
}

const getAuthTypeOptions = (): AuthTypeOption[] => [
  {
    id: 'github-app',
    label: t('provisioning.wizard.auth-type-github-app-label', 'Connect with GitHub App'),
    description: t(
      'provisioning.wizard.auth-type-github-app-description',
      'Use a GitHub App for enhanced security and team collaboration. Recommended for production environments.'
    ),
    icon: 'github',
  },
  {
    id: 'pat',
    label: t('provisioning.wizard.auth-type-pat-label', 'Connect with Personal Access Token'),
    description: t(
      'provisioning.wizard.auth-type-pat-description',
      'Use a personal access token to authenticate with GitHub. Suitable for individual use and testing.'
    ),
    icon: 'key-skeleton-alt',
  },
];

export function AuthTypeStep({ onGitHubAppSubmit }: AuthTypeStepProps) {
  const { control, watch } = useFormContext<WizardFormData>();
  const [githubAuthType, githubAppMode, githubAppConnectionName] = watch([
    'githubAuthType',
    'githubAppMode',
    'githubApp.connectionName',
  ]);
  const authTypeOptions = useMemo(() => getAuthTypeOptions(), []);
  const shouldShowRepositories = githubAuthType !== 'github-app' || githubAppMode !== 'new';

  const shouldFetchConnections = githubAuthType === 'github-app';
  const [connections] = useConnectionList(shouldFetchConnections ? {} : skipToken);

  const isSelectedConnectionReady = useMemo(() => {
    const selectedConnection = connections?.find((c) => c.metadata?.name === githubAppConnectionName);
    return isConnectionReady(selectedConnection?.status);
  }, [connections, githubAppConnectionName]);

  return (
    <Stack direction="column" gap={2}>
      <Field
        noMargin
        label={t('provisioning.wizard.auth-type-label', 'Authentication method')}
        description={t(
          'provisioning.wizard.auth-type-description',
          'Both methods provide secure access to your GitHub repositories. Choose the one that best fits your workflow and security requirements.'
        )}
      >
        <Controller
          name="githubAuthType"
          control={control}
          render={({ field: { onChange, value } }) => (
            <RadioButtonGroup<GitHubAuthType>
              value={value}
              onChange={onChange}
              options={authTypeOptions.map((option) => ({
                label: option.label,
                value: option.id,
                description: option.description,
              }))}
            />
          )}
        />
      </Field>

      {githubAuthType === 'github-app' ? (
        <GitHubAppFields onGitHubAppSubmit={onGitHubAppSubmit} />
      ) : (
        <RepositoryTokenInput />
      )}

      {shouldShowRepositories && <RepositoryField isSelectedConnectionReady={isSelectedConnectionReady} />}
    </Stack>
  );
}
