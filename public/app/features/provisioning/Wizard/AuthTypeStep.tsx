import { forwardRef, memo, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Card, Icon, RadioButtonGroup, Stack, Text } from '@grafana/ui';

import { GitHubAppStep, GitHubAppStepRef } from './GitHubAppStep';
import { RepositoriesList } from './components/RepositoriesList';
import { RepositoryTokenInput } from './components/RepositoryTokenInput';
import { ConnectionCreationResult, GitHubAuthType, WizardFormData } from './types';

interface AuthTypeOption {
  id: GitHubAuthType;
  label: string;
  description: string;
  icon: 'key-skeleton-alt' | 'github';
}

interface GitHubAppStepProps {
  onSubmit: (result: ConnectionCreationResult) => void;
}

const getAuthTypeOptions = (): AuthTypeOption[] => [
  {
    id: 'pat',
    label: t('provisioning.wizard.auth-type-pat-label', 'Connect with Personal Access Token'),
    description: t(
      'provisioning.wizard.auth-type-pat-description',
      'Use a personal access token to authenticate with GitHub. Suitable for individual use and testing.'
    ),
    icon: 'key-skeleton-alt',
  },
  {
    id: 'github-app',
    label: t('provisioning.wizard.auth-type-github-app-label', 'Connect with GitHub App'),
    description: t(
      'provisioning.wizard.auth-type-github-app-description',
      'Use a GitHub App for enhanced security and team collaboration. Recommended for production environments.'
    ),
    icon: 'github',
  },
];

export const AuthTypeStep = forwardRef<GitHubAppStepRef | null, GitHubAppStepProps>(function AuthTypeStep(
  { onSubmit },
  ref
) {
  const { control, watch } = useFormContext<WizardFormData>();
  const [githubAuthType, githubAppMode] = watch(['githubAuthType', 'githubAppMode']);
  const authTypeOptions = useMemo(() => getAuthTypeOptions(), []);
  const shouldShowRepositories = githubAuthType !== 'github-app' || githubAppMode !== 'new';

  return (
    <Stack direction="column" gap={2}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="provisioning.wizard.auth-type-subtitle">
          Both methods provide secure access to your GitHub repositories. Choose the one that best fits your workflow
          and security requirements.
        </Trans>
      </Text>

      <Stack>
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
      </Stack>

      {githubAuthType === 'github-app' ? <GitHubAppStep onSubmit={onSubmit} /> : <RepositoryTokenInput />}

      {shouldShowRepositories && <RepositoriesList />}
    </Stack>
  );
});
