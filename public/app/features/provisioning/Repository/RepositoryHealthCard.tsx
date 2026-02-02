import { css } from '@emotion/css';
import { skipToken } from '@reduxjs/toolkit/query/react';

import { t, Trans } from '@grafana/i18n';
import { Badge, Card, Grid, Stack, Text, useStyles2 } from '@grafana/ui';
import { Repository, useGetConnectionQuery } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectionStatusBadge } from '../Connection/ConnectionStatusBadge';
import { formatTimestamp } from '../utils/time';

import { CheckRepository } from './CheckRepository';

export function RepositoryHealthCard({ repo }: { repo: Repository }) {
  const styles = useStyles2(getStyles);
  const status = repo.status;
  const connectionName = repo.spec?.connection?.name;
  const { data: connection } = useGetConnectionQuery(connectionName ? { name: connectionName } : skipToken);

  return (
    <Card noMargin className={styles.card}>
      <Card.Heading>
        <Trans i18nKey="provisioning.repository-overview.health">Health</Trans>
      </Card.Heading>
      <Card.Description>
        <Grid columns={3} gap={1} alignItems="baseline">
          {/* Status */}
          <Text color="secondary">
            <Trans i18nKey="provisioning.repository-overview.status">Status:</Trans>
          </Text>

          <div className={styles.spanTwo}>
            <Badge
              color={status?.health?.healthy ? 'green' : 'red'}
              text={
                status?.health?.healthy
                  ? t('provisioning.repository-overview.healthy', 'Healthy')
                  : t('provisioning.repository-overview.unhealthy', 'Unhealthy')
              }
              icon={status?.health?.healthy ? 'check-circle' : 'exclamation-triangle'}
            />
          </div>

          {/* Checked */}
          <Text color="secondary">
            <Trans i18nKey="provisioning.repository-overview.checked">Checked:</Trans>
          </Text>
          <div className={styles.spanTwo}>
            <Text variant="body">{formatTimestamp(status?.health?.checked)}</Text>
          </div>

          {!!status?.health?.message?.length && (
            <>
              <div>
                <Text color="secondary">
                  <Trans i18nKey="provisioning.repository-overview.messages">Messages:</Trans>
                </Text>
              </div>
              <div>
                <Stack gap={1}>
                  {status.health.message.map((msg, idx) => (
                    <Text key={idx} variant="body">
                      {msg}
                    </Text>
                  ))}
                </Stack>
              </div>
            </>
          )}

          {/* Connection status */}
          {connectionName && (
            <>
              <Text color="secondary">
                <Trans i18nKey="provisioning.repository-overview.connection-status">Connection status:</Trans>
              </Text>
              <div className={styles.spanTwo}>
                <ConnectionStatusBadge status={connection?.status} />
              </div>
            </>
          )}
        </Grid>
      </Card.Description>
      <Card.Actions className={styles.actions}>
        <CheckRepository repository={repo} />
      </Card.Actions>
    </Card>
  );
}

const getStyles = () => {
  return {
    spanTwo: css({
      gridColumn: 'span 2',
    }),
    card: css({
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }),
    actions: css({
      marginTop: 'auto',
    }),
  };
};
