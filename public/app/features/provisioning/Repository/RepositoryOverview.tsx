import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Box, Card, CellProps, Grid, InteractiveTable, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { Repository, ResourceCount } from 'app/api/clients/provisioning/v0alpha1';

import { RecentJobs } from '../Job/RecentJobs';
import { formatTimestamp } from '../utils/time';

import { RepositoryHealthCard } from './RepositoryHealthCard';
import { RepositoryPullStatusCard } from './RepositoryPullStatusCard';

type StatCell<T extends keyof ResourceCount = keyof ResourceCount> = CellProps<ResourceCount, ResourceCount[T]>;

function getColumnCount(hasWebhook: boolean): { xxlColumn: 5 | 4; lgColumn: 3 | 2 } {
  return {
    xxlColumn: hasWebhook ? 5 : 4,
    lgColumn: hasWebhook ? 3 : 2,
  };
}

export function RepositoryOverview({ repo }: { repo: Repository }) {
  const styles = useStyles2(getStyles);

  const status = repo.status;
  const webhookURL = getWebhookURL(repo);
  const { lgColumn, xxlColumn } = getColumnCount(Boolean(repo.status?.webhook));

  const resourceColumns = useMemo(
    () => [
      {
        id: 'Resource',
        header: 'Resource Type',
        cell: ({ row: { original } }: StatCell<'resource'>) => {
          return <span>{original.resource}</span>;
        },
        size: 'auto',
      },
      {
        id: 'count',
        header: 'Count',
        cell: ({ row: { original } }: StatCell<'count'>) => {
          return <span>{original.count}</span>;
        },
        size: 100,
      },
    ],
    []
  );
  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        <Grid columns={{ xs: 1, sm: 2, lg: lgColumn, xxl: xxlColumn }} gap={2} alignItems={'flex-start'}>
          <div className={styles.cardContainer}>
            <Card noMargin className={styles.card}>
              <Card.Heading>
                <Trans i18nKey="provisioning.repository-overview.resources">Resources</Trans>
              </Card.Heading>
              <Card.Description>
                {repo.status?.stats ? (
                  <InteractiveTable
                    columns={resourceColumns}
                    data={repo.status.stats}
                    getRowId={(r: ResourceCount) => `${r.group}-${r.resource}`}
                  />
                ) : null}
              </Card.Description>
              <Card.Actions className={styles.actions}>
                <LinkButton size="md" href={getFolderURL(repo)} icon="folder-open" variant="secondary">
                  <Trans i18nKey="provisioning.repository-overview.view-folder">View Folder</Trans>
                </LinkButton>
              </Card.Actions>
            </Card>
          </div>

          {repo.status?.health && (
            <div className={styles.cardContainer}>
              <RepositoryHealthCard repo={repo} />
            </div>
          )}

          {/* Webhook */}
          {repo.status?.webhook && (
            <div className={styles.cardContainer}>
              <Card noMargin className={styles.card}>
                <Card.Heading>
                  <Trans i18nKey="provisioning.repository-overview.webhook">Webhook</Trans>
                </Card.Heading>
                <Card.Description>
                  <Grid columns={12} gap={1} alignItems="baseline">
                    <div className={styles.labelColumn}>
                      <Text color="secondary">
                        <Trans i18nKey="provisioning.repository-overview.webhook-id">ID:</Trans>
                      </Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{status?.webhook?.id ?? 'N/A'}</Text>
                    </div>
                    <div className={styles.labelColumn}>
                      <Text color="secondary">
                        <Trans i18nKey="provisioning.repository-overview.webhook-events">Events:</Trans>
                      </Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{status?.webhook?.subscribedEvents?.join(', ') ?? 'N/A'}</Text>
                    </div>
                    <div className={styles.labelColumn}>
                      <Text color="secondary">
                        <Trans i18nKey="provisioning.repository-overview.webhook-last-event">Last Event:</Trans>
                      </Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{formatTimestamp(status?.webhook?.lastEvent)}</Text>
                    </div>
                  </Grid>
                </Card.Description>
                {webhookURL && (
                  <Card.Actions className={styles.actions}>
                    <LinkButton fill="outline" href={webhookURL} icon="external-link-alt">
                      <Trans i18nKey="provisioning.repository-overview.webhook-url">View Webhook</Trans>
                    </LinkButton>
                  </Card.Actions>
                )}
              </Card>
            </div>
          )}

          {/* Pull status */}
          <div
            className={cx(
              styles.pullStatusCard,
              repo.status?.webhook ? styles.pullStatusCardLgSpan3 : styles.pullStatusCardLgSpan2
            )}
          >
            <RepositoryPullStatusCard repo={repo} />
          </div>
        </Grid>

        {/* job status is not ready for Cloud yet */}
        {(config.buildInfo.edition === GrafanaEdition.OpenSource ||
          config.buildInfo.edition === GrafanaEdition.Enterprise) && (
          <div className={styles.cardContainer}>
            <RecentJobs repo={repo} />
          </div>
        )}
      </Stack>
    </Box>
  );
}

function getFolderURL(repo: Repository) {
  if (repo.spec?.sync.target === 'folder') {
    return `/dashboards/f/${repo.metadata?.name}`;
  }
  return '/dashboards';
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardContainer: css({
      height: '100%',
    }),
    card: css({
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }),
    actions: css({
      marginTop: 'auto',
    }),
    labelColumn: css({
      minWidth: theme.spacing(10),
      gridColumn: 'span 3',
    }),
    valueColumn: css({
      gridColumn: 'span 9',
    }),
    pullStatusCard: css({
      gridColumn: 'span 2',

      [theme.breakpoints.down('lg')]: {
        gridColumn: 'span 2',
      },
    }),
    pullStatusCardLgSpan3: css({
      [theme.breakpoints.down('xxl')]: {
        gridColumn: 'span 3',
      },
    }),
    pullStatusCardLgSpan2: css({
      [theme.breakpoints.down('xxl')]: {
        gridColumn: 'span 2',
      },
    }),
  };
};

function getWebhookURL(repo: Repository) {
  const { status, spec } = repo;
  if (spec?.type === 'github' && status?.webhook?.url && spec.github?.url) {
    return `${spec.github.url}/settings/hooks/${status.webhook?.id}`;
  }
  return undefined;
}
