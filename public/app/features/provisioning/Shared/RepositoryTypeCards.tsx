import { css } from '@emotion/css';

import { Trans } from '@grafana/i18n';
import { Card, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1/endpoints.gen';

import { CONNECT_URL } from '../constants';
import { getRepositoryTypeConfigs, isGitProvider } from '../utils/repositoryTypes';

export function RepositoryTypeCards() {
  const styles = useStyles2(getStyles);
  const { data: frontendSettings } = useGetFrontendSettingsQuery();

  const availableTypes = frontendSettings?.availableRepositoryTypes || ['github', 'local'];
  const repositoryConfigs = getRepositoryTypeConfigs().filter((config) => availableTypes.includes(config.type));

  // Separate git providers from other providers
  const gitProviders = repositoryConfigs.filter((config) => isGitProvider(config.type) && config.type !== 'git');
  const otherProviders = repositoryConfigs.filter((config) => !isGitProvider(config.type) || config.type === 'git');

  return (
    <Stack direction="column" gap={2}>
      {gitProviders.length > 0 && (
        <Stack direction="column">
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="provisioning.repository-type-cards.choose-provider">Choose a provider:</Trans>
          </Text>

          <Stack direction="row" gap={1} wrap>
            {gitProviders.map((config) => (
              <Card key={config.type} href={`${CONNECT_URL}/${config.type}`} className={styles.card} noMargin>
                <Stack gap={2} alignItems="center">
                  <Icon name={config.icon} size="xxl" />
                  <Trans
                    i18nKey="provisioning.repository-type-cards.configure-with-provider"
                    values={{ provider: config.label }}
                  >
                    Configure with {'{{ provider }}'}
                  </Trans>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}

      <Stack direction="column">
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="provisioning.repository-type-cards.provider-not-listed">
            If your provider is not listed:
          </Trans>
        </Text>

        <Stack direction="row" gap={1} wrap>
          {otherProviders.map((config) => (
            <Card key={config.type} href={`${CONNECT_URL}/${config.type}`} className={styles.card} noMargin>
              <Stack gap={2} alignItems="center">
                <Icon name={config.icon} size="xxl" />
                {config.type === 'local' ? (
                  <Trans i18nKey="provisioning.repository-type-cards.configure-file">Configure file provisioning</Trans>
                ) : (
                  <Trans
                    i18nKey="provisioning.repository-type-cards.configure-with-provider"
                    values={{ provider: config.label }}
                  >
                    Configure with {'{{ provider }}'}
                  </Trans>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}

function getStyles() {
  return {
    card: css({
      width: 220,
    }),
  };
}
