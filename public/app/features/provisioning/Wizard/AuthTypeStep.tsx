import { css } from '@emotion/css';
import { memo, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Card, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { GitHubAuthType, WizardFormData } from './types';

interface AuthTypeOption {
  id: GitHubAuthType;
  label: string;
  description: string;
  icon: 'key-skeleton-alt' | 'github';
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

export const AuthTypeStep = memo(function AuthTypeStep() {
  const { control } = useFormContext<WizardFormData>();
  const styles = useStyles2(getStyles);

  const authTypeOptions = useMemo(() => getAuthTypeOptions(), []);

  return (
    <Stack direction="column" gap={2}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="provisioning.wizard.auth-type-subtitle">
          Both methods provide secure access to your GitHub repositories. Choose the one that best fits your workflow
          and security requirements.
        </Trans>
      </Text>

      <Controller
        name="githubAuthType"
        control={control}
        render={({ field: { onChange, value } }) => (
          <Stack direction="column" gap={2}>
            {authTypeOptions.map((option) => (
              <Card
                key={option.id}
                noMargin
                isSelected={value === option.id}
                onClick={() => {
                  onChange(option.id);
                  reportInteraction('grafana_provisioning_wizard_auth_type_selected', {
                    authType: option.id,
                  });
                }}
                className={styles.card}
              >
                <Card.Figure>
                  <Icon name={option.icon} size="xxxl" />
                </Card.Figure>
                <Card.Heading>{option.label}</Card.Heading>
                <Card.Description>{option.description}</Card.Description>
              </Card>
            ))}
          </Stack>
        )}
      />
    </Stack>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.colors.background.secondary,
    },
  }),
});
