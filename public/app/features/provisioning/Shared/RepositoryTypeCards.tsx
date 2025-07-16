import { css } from '@emotion/css';

import { Trans } from '@grafana/i18n';
import { Card, Grid, Icon, Stack, useStyles2 } from '@grafana/ui';
import { ResponsiveProp } from '@grafana/ui/internal';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1/endpoints.gen';

import { CONNECT_URL } from '../constants';
import { getRepositoryTypeConfigs } from '../utils/repositoryTypes';

export function RepositoryTypeCards() {
  const styles = useStyles2(getStyles);
  const { data: frontendSettings } = useGetFrontendSettingsQuery();

  const availableTypes = frontendSettings?.availableRepositoryTypes || ['github', 'local'];
  const repositoryConfigs = getRepositoryTypeConfigs().filter((config) => availableTypes.includes(config.type));

  // Calculate total number of cards (repositoryConfigs + 1 for local file provisioning)
  const totalCards = repositoryConfigs.length + 1;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const columnsCount = Math.min(totalCards, 3) as ResponsiveProp<1 | 2 | 3>;

  return (
    <Grid gap={1} columns={columnsCount}>
      {repositoryConfigs.map((config) => (
        <Card key={config.type} href={`${CONNECT_URL}/${config.type}`} className={styles.card} noMargin>
          <Card.Heading>
            <Stack alignItems="center" gap={2}>
              <Icon name={config.icon} size="xxl" />
              <Trans
                i18nKey="provisioning.repository-type-cards.configure-with-provider"
                values={{ provider: config.label }}
              >
                Configure with {'{{ provider }}'}
              </Trans>
            </Stack>
          </Card.Heading>
        </Card>
      ))}
      <Card href={`${CONNECT_URL}/local`} className={styles.card} noMargin>
        <Card.Heading>
          <Stack alignItems="center" gap={2}>
            <Icon name="file-alt" size="lg" />
            <Trans i18nKey="provisioning.repository-type-cards.configure-file">Configure file provisioning</Trans>
          </Stack>
        </Card.Heading>
      </Card>
    </Grid>
  );
}

function getStyles() {
  return {
    card: css({
      minWidth: '200px',
    }),
  };
}
