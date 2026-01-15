import { css } from '@emotion/css';
import { memo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Card, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

import { GitHubAuthType, WizardFormData } from './types';

interface AuthTypeOption {
  id: GitHubAuthType;
  labelKey: string;
  labelDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
  icon: 'key-skeleton-alt' | 'github';
}

const authTypeOptions: AuthTypeOption[] = [
  {
    id: 'pat',
    labelKey: 'provisioning.wizard.auth-type-pat-label',
    labelDefault: 'Connect with Personal Access Token',
    descriptionKey: 'provisioning.wizard.auth-type-pat-description',
    descriptionDefault:
      'Use a personal access token to authenticate with GitHub. Suitable for individual use and testing.',
    icon: 'key-skeleton-alt',
  },
  {
    id: 'github-app',
    labelKey: 'provisioning.wizard.auth-type-github-app-label',
    labelDefault: 'Connect with GitHub App',
    descriptionKey: 'provisioning.wizard.auth-type-github-app-description',
    descriptionDefault:
      'Use a GitHub App for enhanced security and team collaboration. Recommended for production environments.',
    icon: 'github',
  },
];

export const AuthTypeStep = memo(function AuthTypeStep() {
  const { control } = useFormContext<WizardFormData>();
  const styles = useStyles2(getStyles);

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
                <Card.Heading>{t(option.labelKey, option.labelDefault)}</Card.Heading>
                <Card.Description>{t(option.descriptionKey, option.descriptionDefault)}</Card.Description>
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
