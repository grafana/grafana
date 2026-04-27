import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { Trans } from '@grafana/i18n';
import { Card, IconButton, Stack, Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { CONNECT_URL } from '../constants';
import { getOrderedRepositoryConfigs } from '../utils/repositoryTypes';

import { QuotaLimitNote } from './QuotaLimitNote';
import { RepoIcon } from './RepoIcon';

interface RepositoryTypeCardsProps {
  disabled?: boolean;
}

export function RepositoryTypeCards({ disabled }: RepositoryTypeCardsProps) {
  const styles = useStyles2(getStyles, disabled);
  const { data: frontendSettings } = useGetFrontendSettingsQuery();

  const availableTypes = frontendSettings?.availableRepositoryTypes ?? [];
  const { gitProviders, otherProviders } = getOrderedRepositoryConfigs(availableTypes);

  return (
    <Stack direction="column" gap={2}>
      {gitProviders.length > 0 && (
        <Stack direction="column">
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="provisioning.repository-type-cards.choose-provider">Choose a provider:</Trans>
          </Text>

          <Stack direction="row" gap={1} wrap>
            {gitProviders.map((config) => (
              <Card
                key={config.type}
                href={disabled ? undefined : `${CONNECT_URL}/${config.type}`}
                className={styles.card}
                noMargin
                disabled={disabled}
              >
                <Card.Heading>
                  <Stack gap={2} alignItems="center">
                    <RepoIcon type={config.type} />
                    <Trans
                      i18nKey="provisioning.repository-type-cards.configure-with-provider"
                      values={{ provider: config.label }}
                    >
                      Configure with {'{{ provider }}'}
                    </Trans>
                    {config.tooltip && (
                      <IconButton
                        name="info-circle"
                        size="sm"
                        tooltip={config.tooltip}
                        className={styles.infoIcon}
                        variant="secondary"
                      />
                    )}
                  </Stack>
                </Card.Heading>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}

      {otherProviders.length > 0 && (
        <Stack direction="column">
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="provisioning.repository-type-cards.provider-not-listed">
              If your provider is not listed:
            </Trans>
          </Text>

          <Stack direction="row" gap={1} wrap>
            {otherProviders.map((config) => (
              <Card
                key={config.type}
                href={disabled ? undefined : `${CONNECT_URL}/${config.type}`}
                className={styles.card}
                noMargin
                disabled={disabled}
              >
                <Card.Heading>
                  <Stack gap={2} alignItems="center">
                    <RepoIcon type={config.type} />
                    {config.type === 'local' ? (
                      <Trans i18nKey="provisioning.repository-type-cards.configure-file">
                        Configure file provisioning
                      </Trans>
                    ) : (
                      <Trans
                        i18nKey="provisioning.repository-type-cards.configure-with-provider"
                        values={{ provider: config.label }}
                      >
                        Configure with {'{{ provider }}'}
                      </Trans>
                    )}
                    {config.tooltip && (
                      <IconButton
                        name="info-circle"
                        size="sm"
                        tooltip={config.tooltip}
                        className={styles.infoIcon}
                        variant="secondary"
                      />
                    )}
                  </Stack>
                </Card.Heading>
              </Card>
            ))}
          </Stack>
        </Stack>
      )}

      {disabled && <QuotaLimitNote maxRepositories={frontendSettings?.maxRepositories} />}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2, disabled?: boolean) {
  return {
    card: css({
      width: 220,
      ...(disabled && {
        cursor: 'not-allowed',
        pointerEvents: 'unset',
        '& h2': {
          color: theme.colors.text.secondary,
        },
      }),
    }),
    infoIcon: css({
      zIndex: 1,
    }),
  };
}
