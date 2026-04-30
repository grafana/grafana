import { css } from '@emotion/css';
import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Field, RadioButtonGroup, Stack, TextLink, useStyles2 } from '@grafana/ui';

import { useConnectionStatus } from '../hooks/useConnectionStatus';

import { GitHubAppFields } from './GitHubAppFields';
import { RepositoryField } from './components/RepositoryField';
import { RepositoryTokenInput } from './components/RepositoryTokenInput';
import { type ConnectionCreationResult, type GitHubAuthType, type WizardFormData } from './types';

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
  const styles = useStyles2(getStyles);
  const { control, watch } = useFormContext<WizardFormData>();
  const [githubAuthType, githubAppMode, githubAppConnectionName, repoType] = watch([
    'githubAuthType',
    'githubAppMode',
    'githubApp.connectionName',
    'repository.type',
  ]);
  const authTypeOptions = useMemo(() => getAuthTypeOptions(), []);
  const shouldShowRepositories = githubAuthType !== 'github-app' || githubAppMode !== 'new';
  const isGitHub = repoType === 'github';

  const { isConnected: isSelectedConnectionReady } = useConnectionStatus(
    githubAuthType === 'github-app' ? githubAppConnectionName : undefined
  );

  const isGit = repoType === 'git';

  return (
    <Stack direction="column" gap={2}>
      {isGit && (
        <Alert
          severity="info"
          title={t('provisioning.wizard.git-protocol-alert-title', 'Only Git v2 Smart HTTP protocol is supported')}
        >
          <Trans i18nKey="provisioning.wizard.git-protocol-alert-body">
            The Pure Git repository type communicates with your Git server using the{' '}
            <TextLink external href="https://git-scm.com/docs/protocol-v2">
              Git v2 Smart HTTP protocol
            </TextLink>
            . SSH and the legacy v1 protocol are not supported. Make sure your Git server supports Smart HTTP before
            proceeding. For more details, see the{' '}
            <TextLink
              external
              href="https://grafana.com/docs/grafana-cloud/as-code/observability-as-code/git-sync/usage-limits/#the-pure-git-repository-type"
            >
              usage limits documentation
            </TextLink>
            .
          </Trans>
        </Alert>
      )}

      {isGitHub && (
        <Alert
          severity="info"
          title={t('provisioning.wizard.github-enterprise-alert-title', 'GitHub Enterprise Server')}
        >
          <Trans i18nKey="provisioning.wizard.github-enterprise-alert-body">
            GitHub Enterprise Server is currently only supported through the Pure Git repository type. Native GitHub
            Enterprise integration is planned and will be available in the upcoming months.
          </Trans>
        </Alert>
      )}

      {/* PAT & Github App Switch - only for GitHub repositories */}
      {isGitHub && (
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
                className={styles.authTypeRadios}
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
      )}

      {githubAuthType === 'github-app' ? (
        <GitHubAppFields onGitHubAppSubmit={onGitHubAppSubmit} />
      ) : (
        <RepositoryTokenInput />
      )}

      {shouldShowRepositories && <RepositoryField isSelectedConnectionReady={isSelectedConnectionReady} />}
    </Stack>
  );
}

const getStyles = (_theme: GrafanaTheme2) => ({
  authTypeRadios: css({
    maxWidth: '100%',
    overflowX: 'auto',
  }),
});
