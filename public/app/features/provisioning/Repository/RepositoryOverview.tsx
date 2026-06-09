import { css, cx } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo } from 'react';

import { textUtil, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Box,
  Card,
  type CellProps,
  Grid,
  Icon,
  type IconName,
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
import { getResourceIcon, getResourceLabel, getResourceListUrl } from '../utils/resourceKinds';
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
          return (
            <Stack direction="row" gap={1} alignItems="center">
              <Icon name={getResourceIcon(original.group, original.resource)} />
              <span>{getResourceLabel(original.group, original.resource)}</span>
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
    ],
    []
  );

  // Derive the "view" actions from the repository's stats, routing and labelling
  // each kind through its descriptor. Kinds that resolve to the same destination
  // (e.g. dashboards + folders under a folder-synced repo) collapse into one
  // button, and unknown kinds fall back gracefully.
  const viewLinks = useMemo(() => {
    const ctx = { repoName, syncTarget: repo.spec?.sync.target };
    const folderUrl = `/dashboards/f/${repoName}`;
    const links = new Map<string, { href: string; icon: IconName; label: string }>();

    for (const stat of status?.stats ?? []) {
      const href = getResourceListUrl(stat.group, stat.resource, ctx);
      if (links.has(href)) {
        continue;
      }
      // When the destination is the repository's own folder, keep the familiar
      // folder framing rather than a per-kind label.
      const isRepoFolder = repo.spec?.sync.target === 'folder' && href === folderUrl;
      links.set(href, {
        href,
        icon: isRepoFolder ? 'folder-open' : getResourceIcon(stat.group, stat.resource),
        label: isRepoFolder
          ? t('provisioning.repository-overview.view-folder', 'View Folder')
          : getResourceLabel(stat.group, stat.resource),
      });
    }

    // Always offer at least the folder/dashboards view, preserving prior behavior
    // when a repository reports no stats yet.
    if (links.size === 0) {
      const href = getResourceListUrl(undefined, undefined, ctx);
      links.set(href, {
        href,
        icon: 'folder-open',
        label: t('provisioning.repository-overview.view-folder', 'View Folder'),
      });
    }

    return [...links.values()];
  }, [repoName, repo.spec?.sync.target, status?.stats]);

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
              <Card.Actions className={styles.actions}>
                {viewLinks.map((link) => (
                  <LinkButton key={link.href} size="md" href={link.href} icon={link.icon} variant="secondary">
                    {link.label}
                  </LinkButton>
                ))}
              </Card.Actions>
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
  if (spec?.type === 'github' && status?.webhook?.url && spec.github?.url) {
    return textUtil.sanitizeUrl(`${spec.github.url}/settings/hooks/${status.webhook?.id}`);
  }
  return undefined;
}
