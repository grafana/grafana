import { css } from '@emotion/css';
import { useMemo } from 'react';

import {
  CellProps,
  Stack,
  Box,
  Text,
  LinkButton,
  Card,
  TextLink,
  InteractiveTable,
  Grid,
  useStyles2,
} from '@grafana/ui';
import { Repository, ResourceCount } from 'app/api/clients/provisioning';

import { RecentJobs } from '../Job/RecentJobs';
import { formatTimestamp } from '../utils/time';

import { CheckRepository } from './CheckRepository';
import { RepositoryHealth } from './RepositoryHealth';
import { SyncRepository } from './SyncRepository';

type StatCell<T extends keyof ResourceCount = keyof ResourceCount> = CellProps<ResourceCount, ResourceCount[T]>;

export function RepositoryOverview({ repo }: { repo: Repository }) {
  const styles = useStyles2(getStyles);
  const status = repo.status;
  const webhookURL = getWebhookURL(repo);

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
        <Grid columns={3} gap={2}>
          <div className={styles.cardContainer}>
            <Card className={styles.card}>
              <Card.Heading>Resources</Card.Heading>
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
                  View Folder
                </LinkButton>
              </Card.Actions>
            </Card>
          </div>
          {repo.status?.health && (
            <div className={styles.cardContainer}>
              <Card className={styles.card}>
                <Card.Heading>Health</Card.Heading>
                <Card.Description>
                  <RepositoryHealth health={repo.status?.health} />
                  <Grid columns={12} gap={1} alignItems="baseline">
                    <div className={styles.labelColumn}>
                      <Text color="secondary">Status:</Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{status?.health?.healthy ? 'Healthy' : 'Unhealthy'}</Text>
                    </div>

                    <div className={styles.labelColumn}>
                      <Text color="secondary">Checked:</Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{formatTimestamp(status?.health?.checked)}</Text>
                    </div>

                    {!!status?.health?.message?.length && (
                      <>
                        <div className={styles.labelColumn}>
                          <Text color="secondary">Messages:</Text>
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
            <Card className={styles.card}>
              <Card.Heading>Pull status</Card.Heading>
              <Card.Description>
                <Grid columns={12} gap={1} alignItems="baseline">
                  <div className={styles.labelColumn}>
                    <Text color="secondary">Status:</Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{status?.sync.state ?? 'N/A'}</Text>
                  </div>

                  <div className={styles.labelColumn}>
                    <Text color="secondary">Job ID:</Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{status?.sync.job ?? 'N/A'}</Text>
                  </div>

                  <div className={styles.labelColumn}>
                    <Text color="secondary">Last Ref:</Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{status?.sync.lastRef ? status.sync.lastRef.substring(0, 7) : 'N/A'}</Text>
                  </div>

                  <div className={styles.labelColumn}>
                    <Text color="secondary">Started:</Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{formatTimestamp(status?.sync.started)}</Text>
                  </div>

                  <div className={styles.labelColumn}>
                    <Text color="secondary">Finished:</Text>
                  </div>
                  <div className={styles.valueColumn}>
                    <Text variant="body">{formatTimestamp(status?.sync.finished)}</Text>
                  </div>

                  {!!status?.sync?.message?.length && (
                    <>
                      <div className={styles.labelColumn}>
                        <Text color="secondary">Messages:</Text>
                      </div>
                      <div className={styles.valueColumn}>
                        <Stack gap={1}>
                          {status.sync.message.map((msg, idx) => (
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
                <SyncRepository repository={repo} />
                {webhookURL && (
                  <TextLink external href={webhookURL} icon="link">
                    Webhook
                  </TextLink>
                )}
              </Card.Actions>
            </Card>
          </div>
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
