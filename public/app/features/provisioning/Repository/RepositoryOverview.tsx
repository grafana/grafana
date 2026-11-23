import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { textUtil, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Box, Card, Grid, Icon, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { RecentJobs } from '../Job/RecentJobs';
import { QuotaLimitNote } from '../Shared/QuotaLimitNote';
import { MissingFolderMetadataBanner } from '../components/Folders/MissingFolderMetadataBanner';
import { WorkflowBadges } from '../components/WorkflowBadges';
import { hasMissingFolderMetadata } from '../utils/folderMetadata';
import { getRemoteConfig } from '../utils/git';
import { isQuotaReachedOrExceeded } from '../utils/quota';
import { getRepositoryResourcesUrl } from '../utils/repository';
import { isGitHubBased } from '../utils/repositoryTypes';
import { getKindInfoByStat } from '../utils/resourceKinds';
import { formatTimestamp } from '../utils/time';

import { RepositoryHealthCard } from './RepositoryHealthCard';
import { RepositoryPullStatusCard } from './RepositoryPullStatusCard';
import { RepositoryStatusAlert } from './RepositoryStatusAlert';

function getColumnCount(hasWebhook: boolean): { xxlColumn: 5 | 4; lgColumn: 3 | 2 } {
  return {
    xxlColumn: hasWebhook ? 5 : 4,
    lgColumn: hasWebhook ? 3 : 2,
  };
}

// The list scrolls past this, so the card keeps the same height whatever the repository manages.
const ROW_HEIGHT_SPACING = 4;
const VISIBLE_ROWS = 5.5;

const collator = new Intl.Collator();

export function RepositoryOverview({ repo }: { repo: Repository }) {
  const styles = useStyles2(getStyles);
  const repoName = repo.metadata?.name ?? '';

  const status = repo.status;
  const { conditions, quota } = status ?? {};
  const webhookURL = getWebhookURL(repo);
  const { lgColumn, xxlColumn } = getColumnCount(Boolean(status?.webhook));

  const rows = useMemo(
    () =>
      (status?.stats ?? [])
        .map((stat) => {
          const info = getKindInfoByStat(stat);
          return {
            key: `${stat.group}-${stat.resource}`,
            icon: info?.icon ?? 'file-alt',
            label: info?.kind ?? stat.resource,
            count: stat.count,
            href: getRepositoryResourcesUrl(repoName, stat.resource),
          };
        })
        .sort((a, b) => b.count - a.count || collator.compare(a.label, b.label)),
    [status?.stats, repoName]
  );

  const resourceSummary = t('provisioning.repository-overview.resources-summary', '{{resources}} across {{kinds}}', {
    resources: t('provisioning.repository-overview.resources-summary-resources', '', {
      count: rows.reduce((total, row) => total + row.count, 0),
      defaultValue_one: '{{count}} resource',
      defaultValue_other: '{{count}} resources',
    }),
    kinds: t('provisioning.repository-overview.resources-summary-kinds', '', {
      count: rows.length,
      defaultValue_one: '{{count}} kind',
      defaultValue_other: '{{count}} kinds',
    }),
  });

  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        <RepositoryStatusAlert repository={repo} />
        {hasMissingFolderMetadata(conditions) && (
          <MissingFolderMetadataBanner repositoryName={repoName} variant="repo" />
        )}
        <Grid columns={{ xs: 1, sm: 2, lg: lgColumn, xxl: xxlColumn }} gap={2} alignItems={'flex-start'}>
          <div className={cx(styles.cardContainer, styles.shrinkable)}>
            <Card
              noMargin
              className={styles.card}
              data-testid={selectors.pages.Provisioning.RepositoryOverview.resourcesCard}
            >
              <Card.Heading>
                <Stack direction="row" gap={1} alignItems="center" wrap>
                  <Trans i18nKey="provisioning.repository-overview.resources">Resources</Trans>
                  <WorkflowBadges
                    workflows={repo.spec?.workflows}
                    type={repo.spec?.type}
                    branch={getRemoteConfig(repo.spec)?.branch}
                  />
                </Stack>
              </Card.Heading>
              <Card.Description>
                {rows.length ? (
                  <Stack direction="column" gap={1}>
                    <Text color="secondary">{resourceSummary}</Text>
                    <div className={styles.resourceList}>
                      {rows.map((row) => (
                        <div key={row.key} className={styles.resourceRow}>
                          <Icon name={row.icon} />
                          <div className={styles.resourceLabel}>
                            <TextLink href={row.href} color="primary" inline={false} title={row.label}>
                              {row.label}
                            </TextLink>
                          </div>
                          <Text color="secondary" tabular>
                            {row.count}
                          </Text>
                        </div>
                      ))}
                    </div>
                  </Stack>
                ) : (
                  <Text color="secondary">
                    <Trans i18nKey="provisioning.repository-overview.no-resources">
                      No resources are managed by this repository yet.
                    </Trans>
                  </Text>
                )}
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
              <Card
                noMargin
                className={styles.card}
                data-testid={selectors.pages.Provisioning.RepositoryOverview.webhookCard}
              >
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
    // A 1fr grid track takes its minimum from its content, so without this a long kind name widens
    // the card instead of letting the row truncate.
    shrinkable: css({
      minWidth: 0,
    }),
    resourceList: css({
      maxHeight: theme.spacing(ROW_HEIGHT_SPACING * VISIBLE_ROWS),
      overflowY: 'auto',
    }),
    resourceRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      height: theme.spacing(ROW_HEIGHT_SPACING),
    }),
    resourceLabel: css({
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
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
