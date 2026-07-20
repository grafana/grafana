import { css, cx } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo } from 'react';

import { textUtil, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import {
  Box,
  Card,
  type CellProps,
  Grid,
  Icon,
  InteractiveTable,
  LinkButton,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { type Repository, type ResourceCount } from 'app/api/clients/provisioning/v0alpha1';

import { RecentJobs } from '../Job/RecentJobs';
import { QuotaLimitNote } from '../Shared/QuotaLimitNote';
import { MissingFolderMetadataBanner } from '../components/Folders/MissingFolderMetadataBanner';
import { hasMissingFolderMetadata } from '../utils/folderMetadata';
import { isQuotaReachedOrExceeded } from '../utils/quota';
import { isGitHubBased } from '../utils/repositoryTypes';
import { getKindInfoByStat, getRepositoryRoute } from '../utils/resourceKinds';
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
  const repoName = repo.metadata?.name ?? '';
  const showFolderMetadataCheck = useBooleanFlagValue('provisioningFolderMetadata', false);

  const status = repo.status;
  const { conditions, quota } = status ?? {};
  const webhookURL = getWebhookURL(repo);
  const { lgColumn, xxlColumn } = getColumnCount(Boolean(status?.webhook));

  const resourceColumns = useMemo(
    () => [
      {
        id: 'Resource',
        header: 'Resource Type',
        cell: ({ row: { original } }: StatCell<'resource'>) => {
          const info = getKindInfoByStat(original);
          return (
            <Stack direction="row" gap={1} alignItems="center">
              <Icon name={info?.icon ?? 'file-alt'} />
              <span>{info?.kind ?? original.resource}</span>
            </Stack>
          );
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
      {
        id: 'actions',
        header: '',
        cell: ({ row: { original } }: StatCell) => {
          const info = getKindInfoByStat(original);
          // Unknown kinds have no destination, so no action.
          if (!info) {
            return null;
          }
          return (
            <Stack justifyContent="flex-end">
              <LinkButton href={getRepositoryRoute(info, repo)} size="sm" variant="secondary">
                <Trans i18nKey="provisioning.repository-overview.view-resource">View</Trans>
              </LinkButton>
            </Stack>
          );
        },
        size: 100,
      },
    ],
    [repo]
  );
  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        {showFolderMetadataCheck && hasMissingFolderMetadata(conditions) && (
          <MissingFolderMetadataBanner repositoryName={repoName} variant="repo" />
        )}
        <Grid columns={{ xs: 1, sm: 2, lg: lgColumn, xxl: xxlColumn }} gap={2} alignItems={'flex-start'}>
          <div className={styles.cardContainer}>
            <Card noMargin className={styles.card}>
              <Card.Heading>
                <Trans i18nKey="provisioning.repository-overview.resources">Resources</Trans>
              </Card.Heading>
              <Card.Description>
                {status?.stats ? (
                  <InteractiveTable
                    columns={resourceColumns}
                    data={status.stats}
                    getRowId={(r: ResourceCount) => `${r.group}-${r.resource}`}
                  />
                ) : null}
                {isQuotaReachedOrExceeded(conditions, 'ResourceQuota') && (
                  <Box paddingTop={2}>
                    <QuotaLimitNote maxResourcesPerRepository={quota?.maxResourcesPerRepository} />
                  </Box>
                )}
              </Card.Description>
            </Card>
          </div>

          {status?.health && (
            <div className={styles.cardContainer}>
              <RepositoryHealthCard repo={repo} />
            </div>
          )}

          {/* Webhook */}
          {status?.webhook && (
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
                      <Text variant="body">
                        {status?.webhook?.id ?? status?.webhook?.uuid?.replace(/[{}]/g, '') ?? 'N/A'}
                      </Text>
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
                    <LinkButton fill="outline" href={webhookURL} icon="external-link-alt" target="_blank">
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
              status?.webhook ? styles.pullStatusCardLgSpan3 : styles.pullStatusCardLgSpan2
            )}
          >
            <RepositoryPullStatusCard repo={repo} />
          </div>
        </Grid>

        <div className={styles.cardContainer}>
          <RecentJobs repo={repo} />
        </div>
      </Stack>
    </Box>
  );
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
      gap: theme.spacing(2),
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
      height: '100%',
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
  const repoUrl = spec?.github?.url ?? spec?.githubEnterprise?.url ?? spec?.gitlab?.url;
  if (isGitHubBased(spec?.type) && status?.webhook?.url && repoUrl) {
    return textUtil.sanitizeUrl(`${repoUrl}/settings/hooks/${status.webhook?.id}`);
  }
  if (spec?.type === 'gitlab' && status?.webhook?.url && repoUrl) {
    return textUtil.sanitizeUrl(`${repoUrl}/-/hooks/${status.webhook?.id}/edit`);
  }
  if (spec?.type === 'bitbucket' && status?.webhook?.uuid && spec.bitbucket?.url) {
    return textUtil.sanitizeUrl(`${spec.bitbucket.url}/admin/webhooks/${encodeURIComponent(status.webhook.uuid)}/edit`);
  }
  return undefined;
}
