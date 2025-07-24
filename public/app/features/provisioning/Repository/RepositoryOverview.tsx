import { css } from '@emotion/css';
import { useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Box, Card, CellProps, Grid, InteractiveTable, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { Repository, ResourceCount } from 'app/api/clients/provisioning/v0alpha1';

import { RecentJobs } from '../Job/RecentJobs';
import { MessageList } from '../Shared/MessageList';
import { formatTimestamp } from '../utils/time';

import { CheckRepository } from './CheckRepository';
import { RepositoryHealth } from './RepositoryHealth';
import { SyncRepository } from './SyncRepository';

type StatCell<T extends keyof ResourceCount = keyof ResourceCount> = CellProps<ResourceCount, ResourceCount[T]>;

function getColumnCount(hasWebhook: boolean): 3 | 4 {
  return hasWebhook ? 4 : 3;
}

export function RepositoryOverview({ repo }: { repo: Repository }) {
  const styles = useStyles2(getStyles);

  const status = repo.status;
  const webhookURL = getWebhookURL(repo);
  const columns = getColumnCount(Boolean(repo.status?.webhook));

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
        <Grid columns={columns} gap={2}>
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
                <LinkButton fill="outline" size="md" href={getFolderURL(repo)} icon="folder-open">
                  <Trans i18nKey="provisioning.repository-overview.view-folder">View Folder</Trans>
                </LinkButton>
              </Card.Actions>
            </Card>
          </div>
          {repo.status?.health && (
            <div className={styles.cardContainer}>
              <Card noMargin className={styles.card}>
                <Card.Heading>
                  <Trans i18nKey="provisioning.repository-overview.health">Health</Trans>
                </Card.Heading>
                <Card.Description>
                  <RepositoryHealth health={repo.status?.health} />
                  <Grid columns={12} gap={1} alignItems="baseline">
                    <div className={styles.labelColumn}>
                      <Text color="secondary">
                        <Trans i18nKey="provisioning.repository-overview.status">Status:</Trans>
                      </Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">
                        {status?.health?.healthy
                          ? t('provisioning.repository-overview.healthy', 'Healthy')
                          : t('provisioning.repository-overview.unhealthy', 'Unhealthy')}
                      </Text>
                    </div>

                    <div className={styles.labelColumn}>
                      <Text color="secondary">
                        <Trans i18nKey="provisioning.repository-overview.checked">Checked:</Trans>
                      </Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{formatTimestamp(status?.health?.checked)}</Text>
                    </div>

                    {!!status?.health?.message?.length && (
                      <>
                        <div className={styles.labelColumn}>
                          <Text color="secondary">
                            <Trans i18nKey="provisioning.repository-overview.messages">Messages:</Trans>
                          </Text>
                        </div>
                        <div className={styles.valueColumn}>
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
                  </Grid>
                </Card.Description>
                <Card.Actions className={styles.actions}>
                  <CheckRepository repository={repo} />
                </Card.Actions>
              </Card>
            </div>
          )}
          <div className={styles.cardContainer}>
            <Card className={styles.card} noMargin>
              <Card.Heading>
                <Trans i18nKey="provisioning.repository-overview.pull-status">Pull status</Trans>
              </Card.Heading>
              <Card.Description>
                <Grid columns={12} gap={1} alignItems="baseline">
                  <div className={styles.labelColumn}>
                    <Text color="secondary">
                      <Trans i18nKey="provisioning.repository-overview.status">Status:</Trans>
                    </Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{status?.sync.state ?? 'N/A'}</Text>
                  </div>

                  <div className={styles.labelColumn}>
                    <Text color="secondary">
                      <Trans i18nKey="provisioning.repository-overview.job-id">Job ID:</Trans>
                    </Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{status?.sync.job ?? 'N/A'}</Text>
                  </div>

                  <div className={styles.labelColumn}>
                    <Text color="secondary">
                      <Trans i18nKey="provisioning.repository-overview.last-ref">Last Ref:</Trans>
                    </Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">
                      {status?.sync.lastRef
                        ? status.sync.lastRef.substring(0, 7)
                        : t('provisioning.repository-overview.not-available', 'N/A')}
                    </Text>
                  </div>

                  <div className={styles.labelColumn}>
                    <Text color="secondary">
                      <Trans i18nKey="provisioning.repository-overview.started">Started:</Trans>
                    </Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{formatTimestamp(status?.sync.started)}</Text>
                  </div>

                  <div className={styles.labelColumn}>
                    <Text color="secondary">
                      <Trans i18nKey="provisioning.repository-overview.finished">Finished:</Trans>
                    </Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{formatTimestamp(status?.sync.finished)}</Text>
                  </div>

                  {!!status?.sync?.message?.length && (
                    <>
                      <div className={styles.labelColumn}>
                        <Text color="secondary">
                          <Trans i18nKey="provisioning.repository-overview.messages">Messages:</Trans>
                        </Text>
                      </div>
                      <div className={styles.valueColumn}>
                        <MessageList messages={status.sync.message} variant="body" />
                      </div>
                    </>
                  )}
                </Grid>
              </Card.Description>
              <Card.Actions className={styles.actions}>
                <SyncRepository repository={repo} />
              </Card.Actions>
            </Card>
          </div>
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
        </Grid>
        <div className={styles.cardContainer}>
          <RecentJobs repo={repo} />
        </div>
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

const getStyles = () => {
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
      gridColumn: 'span 3',
    }),
    valueColumn: css({
      gridColumn: 'span 9',
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
