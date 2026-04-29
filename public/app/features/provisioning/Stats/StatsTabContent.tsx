import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Box, Card, EmptyState, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import {
  type ManagerStats,
  type ResourceCount,
  type ResourceStats,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

const FOLDER_GROUPS = ['folder.grafana.app', 'folders'];
const DASHBOARD_GROUPS = ['dashboard.grafana.app'];
const GIT_SYNC_SUPPORTED_GROUPS = [...FOLDER_GROUPS, ...DASHBOARD_GROUPS];

interface BreakdownByKind {
  kind: string;
  totals: { total: number; folders: number; dashboards: number };
  managers: Array<{ id: string; total: number; folders: number; dashboards: number }>;
}

interface GroupBreakdown {
  group: string;
  resource: string;
  label: string;
  total: number;
  gitSyncCount: number;
  otherManagedCount: number;
  unmanagedCount: number;
  isGitSyncSupported: boolean;
}

interface ComputedStats {
  instanceTotal: number;
  managedTotal: number;
  unmanagedTotal: number;
  gitSync: BreakdownByKind | null;
  otherProviders: BreakdownByKind[];
  groupBreakdowns: GroupBreakdown[];
}

function totalForManager(stats: ResourceCount[]): { total: number; folders: number; dashboards: number } {
  let total = 0;
  let folders = 0;
  let dashboards = 0;
  stats.forEach((s) => {
    total += s.count;
    if (FOLDER_GROUPS.includes(s.group)) {
      folders += s.count;
    } else if (DASHBOARD_GROUPS.includes(s.group)) {
      dashboards += s.count;
    }
  });
  return { total, folders, dashboards };
}

function resourceLabel(group: string, resource: string): string {
  if (FOLDER_GROUPS.includes(group)) {
    return t('provisioning.stats.folders', 'Folders');
  }
  if (DASHBOARD_GROUPS.includes(group)) {
    return t('provisioning.stats.dashboards', 'Dashboards');
  }
  // For other resource types we don't have dedicated translations. Show the
  // resource name as-is — this is what the API gives us (e.g., "alertrules").
  return resource;
}

function computeGroupBreakdowns(data?: ResourceStats): GroupBreakdown[] {
  const map = new Map<string, GroupBreakdown>();
  const keyOf = (group: string, resource: string) => `${group}/${resource}`;
  const ensure = (group: string, resource: string): GroupBreakdown => {
    const key = keyOf(group, resource);
    let entry = map.get(key);
    if (!entry) {
      entry = {
        group,
        resource,
        label: resourceLabel(group, resource),
        total: 0,
        gitSyncCount: 0,
        otherManagedCount: 0,
        unmanagedCount: 0,
        isGitSyncSupported: GIT_SYNC_SUPPORTED_GROUPS.includes(group),
      };
      map.set(key, entry);
    }
    return entry;
  };

  // Always seed the Git-Sync-supported types so the migration readiness
  // section answers "how many folders and dashboards do I have?" even when
  // the count is zero.
  ensure('folder.grafana.app', 'folders');
  ensure('dashboard.grafana.app', 'dashboards');

  data?.instance?.forEach((c) => {
    ensure(c.group, c.resource).total += c.count;
  });

  data?.managed?.forEach((m) => {
    const isGitSync = (m.kind ?? '') === ManagerKind.Repo;
    m.stats.forEach((s) => {
      const entry = ensure(s.group, s.resource);
      if (isGitSync) {
        entry.gitSyncCount += s.count;
      } else {
        entry.otherManagedCount += s.count;
      }
    });
  });

  map.forEach((entry) => {
    entry.unmanagedCount = Math.max(0, entry.total - entry.gitSyncCount - entry.otherManagedCount);
  });

  return Array.from(map.values()).sort((a, b) => {
    // Surface Git-Sync-supported types first, then sort by total desc.
    if (a.isGitSyncSupported !== b.isGitSyncSupported) {
      return a.isGitSyncSupported ? -1 : 1;
    }
    return b.total - a.total;
  });
}

function computeStats(data?: ResourceStats): ComputedStats {
  const instanceTotal = data?.instance?.reduce((acc, c) => acc + c.count, 0) ?? 0;

  const byKind = new Map<string, BreakdownByKind>();
  data?.managed?.forEach((m: ManagerStats) => {
    const kind = m.kind ?? '';
    let entry = byKind.get(kind);
    if (!entry) {
      entry = { kind, totals: { total: 0, folders: 0, dashboards: 0 }, managers: [] };
      byKind.set(kind, entry);
    }
    const managerTotals = totalForManager(m.stats);
    entry.totals.total += managerTotals.total;
    entry.totals.folders += managerTotals.folders;
    entry.totals.dashboards += managerTotals.dashboards;
    entry.managers.push({ id: m.id || '', ...managerTotals });
  });

  const gitSync = byKind.get(ManagerKind.Repo) ?? null;
  const otherProviders = Array.from(byKind.values()).filter((b) => b.kind !== ManagerKind.Repo);

  const managedTotal = Array.from(byKind.values()).reduce((acc, b) => acc + b.totals.total, 0);
  const unmanagedTotal = Math.max(0, instanceTotal - managedTotal);

  const groupBreakdowns = computeGroupBreakdowns(data);

  return {
    instanceTotal,
    managedTotal,
    unmanagedTotal,
    gitSync,
    otherProviders,
    groupBreakdowns,
  };
}

function kindLabel(kind: string): string {
  switch (kind) {
    case ManagerKind.Repo:
      return t('provisioning.stats.manager-kind-repo', 'Git Sync');
    case ManagerKind.Terraform:
      return t('provisioning.stats.manager-kind-terraform', 'Terraform');
    case ManagerKind.Kubectl:
      return t('provisioning.stats.manager-kind-kubectl', 'kubectl');
    case ManagerKind.Plugin:
      return t('provisioning.stats.manager-kind-plugin', 'Plugin');
    case 'grafana':
      return t('provisioning.stats.manager-kind-grafana', 'Grafana');
    case 'classic-file-provisioning':
      return t('provisioning.stats.manager-kind-classic-fp', 'File provisioning (classic)');
    default:
      return kind || t('provisioning.stats.manager-kind-unknown', 'Unknown');
  }
}

function percent(part: number, total: number): string {
  if (total === 0) {
    return '0%';
  }
  return `${Math.round((part / total) * 100)}%`;
}

function StackedBar({ gitSync, other, unmanaged }: { gitSync: number; other: number; unmanaged: number }) {
  const styles = useStyles2(getStyles);
  const total = gitSync + other + unmanaged;
  if (total === 0) {
    return <div className={styles.bar} />;
  }
  return (
    <div className={styles.bar} role="img">
      {gitSync > 0 && <Box flex={gitSync} backgroundColor="success" height={1} />}
      {other > 0 && <Box flex={other} backgroundColor="info" height={1} />}
      {unmanaged > 0 && <Box flex={unmanaged} backgroundColor="warning" height={1} />}
    </div>
  );
}

function SummarySection({ stats }: { stats: ComputedStats }) {
  const styles = useStyles2(getStyles);
  const managedPct = percent(stats.managedTotal, stats.instanceTotal);
  const unmanagedPct = percent(stats.unmanagedTotal, stats.instanceTotal);
  return (
    <Stack direction="column" gap={1.5}>
      <Stack direction="row" gap={2} wrap>
        <div className={styles.summaryCard}>
          <Text variant="h2">{stats.instanceTotal.toLocaleString()}</Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.summary-total">Total resources</Trans>
          </Text>
        </div>
        <div className={styles.summaryCard}>
          <Stack direction="row" alignItems="baseline" gap={1}>
            <Text variant="h2" color="success">
              {stats.managedTotal.toLocaleString()}
            </Text>
            <Text color="secondary" variant="bodySmall">
              {managedPct}
            </Text>
          </Stack>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.summary-managed">Managed</Trans>
          </Text>
        </div>
        <div className={styles.summaryCard}>
          <Stack direction="row" alignItems="baseline" gap={1}>
            <Text variant="h2" color="warning">
              {stats.unmanagedTotal.toLocaleString()}
            </Text>
            <Text color="secondary" variant="bodySmall">
              {unmanagedPct}
            </Text>
          </Stack>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.summary-unmanaged">Unmanaged</Trans>
          </Text>
        </div>
      </Stack>
      <StackedBar
        gitSync={stats.gitSync?.totals.total ?? 0}
        other={stats.otherProviders.reduce((acc, p) => acc + p.totals.total, 0)}
        unmanaged={stats.unmanagedTotal}
      />
      <LegendRow />
    </Stack>
  );
}

function LegendRow() {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="row" gap={2} wrap>
      <Stack direction="row" gap={1} alignItems="center">
        <span className={styles.legendDotSuccess} />
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.stats.legend-git-sync">Managed by Git Sync</Trans>
        </Text>
      </Stack>
      <Stack direction="row" gap={1} alignItems="center">
        <span className={styles.legendDotInfo} />
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.stats.legend-other">Managed by other providers</Trans>
        </Text>
      </Stack>
      <Stack direction="row" gap={1} alignItems="center">
        <span className={styles.legendDotWarning} />
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.stats.legend-unmanaged">Unmanaged</Trans>
        </Text>
      </Stack>
    </Stack>
  );
}

function MigrationReadinessSection({ breakdowns }: { breakdowns: GroupBreakdown[] }) {
  const supported = breakdowns.filter((b) => b.isGitSyncSupported);
  if (supported.length === 0) {
    return null;
  }

  const totalEligible = supported.reduce((acc, b) => acc + b.unmanagedCount, 0);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="code-branch" />
        <Text variant="h3">
          <Trans i18nKey="provisioning.stats.migration-heading">Git Sync migration readiness</Trans>
        </Text>
      </Stack>
      <Text color="secondary">
        <Trans i18nKey="provisioning.stats.migration-description">
          Git Sync only supports folders and dashboards. Below is where each currently lives.
        </Trans>
      </Text>
      {totalEligible > 0 && (
        <Alert
          severity="info"
          title={t('provisioning.stats.migration-eligible-title', 'Resources eligible to migrate to Git Sync')}
        >
          <Trans i18nKey="provisioning.stats.migration-eligible-description" count={totalEligible}>
            {{ count: totalEligible }} unmanaged resource of a Git-Sync-supported type could be moved into a repository.
          </Trans>
        </Alert>
      )}
      <Stack direction="column" gap={1}>
        {supported.map((b) => (
          <ResourceBreakdownCard key={`${b.group}/${b.resource}`} breakdown={b} />
        ))}
      </Stack>
    </Stack>
  );
}

function ResourceBreakdownCard({ breakdown }: { breakdown: GroupBreakdown }) {
  const styles = useStyles2(getStyles);
  return (
    <Card noMargin>
      <Card.Heading>
        <Stack direction="row" gap={2} alignItems="baseline">
          <Text variant="h5">{breakdown.label}</Text>
          <Text variant="bodySmall" color="secondary">
            {t('provisioning.stats.resource-total', '{{count}} total', { count: breakdown.total })}
          </Text>
        </Stack>
      </Card.Heading>
      <Card.Description>
        <Stack direction="column" gap={1.5}>
          <StackedBar
            gitSync={breakdown.gitSyncCount}
            other={breakdown.otherManagedCount}
            unmanaged={breakdown.unmanagedCount}
          />
          <Stack direction="row" gap={4} wrap>
            <BreakdownStat
              dotClass={styles.legendDotSuccess}
              label={t('provisioning.stats.legend-git-sync', 'Managed by Git Sync')}
              value={breakdown.gitSyncCount}
              total={breakdown.total}
            />
            <BreakdownStat
              dotClass={styles.legendDotInfo}
              label={t('provisioning.stats.legend-other', 'Managed by other providers')}
              value={breakdown.otherManagedCount}
              total={breakdown.total}
            />
            <BreakdownStat
              dotClass={styles.legendDotWarning}
              label={t('provisioning.stats.legend-unmanaged', 'Unmanaged')}
              value={breakdown.unmanagedCount}
              total={breakdown.total}
            />
          </Stack>
        </Stack>
      </Card.Description>
    </Card>
  );
}

function BreakdownStat({
  dotClass,
  label,
  value,
  total,
}: {
  dotClass: string;
  label: string;
  value: number;
  total: number;
}) {
  return (
    <Stack direction="column" gap={0}>
      <Stack direction="row" gap={1} alignItems="center">
        <span className={dotClass} />
        <Text variant="h5">{value.toLocaleString()}</Text>
        <Text variant="bodySmall" color="secondary">
          {percent(value, total)}
        </Text>
      </Stack>
      <Text color="secondary" variant="bodySmall">
        {label}
      </Text>
    </Stack>
  );
}

function GitSyncReposSection({ gitSync }: { gitSync: BreakdownByKind }) {
  if (gitSync.managers.length === 0) {
    return null;
  }
  return (
    <Stack direction="column" gap={2}>
      <Text variant="h4">
        <Trans i18nKey="provisioning.stats.git-sync-repos-heading">By repository</Trans>
      </Text>
      <Stack direction="column" gap={1}>
        {gitSync.managers.map((m, index) => (
          <Card noMargin key={m.id || `git-sync-${index}`}>
            <Card.Heading>
              <Text variant="h5">{m.id || t('provisioning.stats.repository-fallback-name', 'Repository')}</Text>
            </Card.Heading>
            <Card.Description>
              <Stack direction="row" gap={3} wrap>
                <Stat label={t('provisioning.stats.folders', 'Folders')} value={m.folders} />
                <Stat label={t('provisioning.stats.dashboards', 'Dashboards')} value={m.dashboards} />
              </Stack>
            </Card.Description>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function OtherProvidersSection({ providers }: { providers: BreakdownByKind[] }) {
  if (providers.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="cog" />
        <Text variant="h4" color="secondary">
          <Trans i18nKey="provisioning.stats.other-providers-heading">Other providers</Trans>
        </Text>
      </Stack>
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="provisioning.stats.other-providers-description">
          Resources managed by providers other than Git Sync.
        </Trans>
      </Text>
      <Stack direction="column" gap={1}>
        {providers.map((p) => (
          <Card noMargin key={p.kind}>
            <Card.Heading>
              <Text variant="h5">{kindLabel(p.kind)}</Text>
            </Card.Heading>
            <Card.Description>
              <Stack direction="row" gap={3} wrap>
                <Text color="secondary" variant="bodySmall">
                  {t('provisioning.stats.other-provider-resource-count', '{{count}} resource', {
                    count: p.totals.total,
                  })}
                  {' • '}
                  {t('provisioning.stats.other-provider-manager-count', '{{count}} manager', {
                    count: p.managers.length,
                  })}
                </Text>
              </Stack>
            </Card.Description>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function AllResourcesSection({ breakdowns }: { breakdowns: GroupBreakdown[] }) {
  const styles = useStyles2(getStyles);
  // Drop the seeded zero-count entries — they're useful in the migration
  // readiness section but would just be noise here.
  const visible = breakdowns.filter((b) => b.total > 0);
  if (visible.length === 0) {
    return null;
  }
  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="list-ul" />
        <Text variant="h4">
          <Trans i18nKey="provisioning.stats.all-resources-heading">All resource types</Trans>
        </Text>
      </Stack>
      <div className={styles.allResourcesGrid} role="table">
        <div className={styles.allResourcesHeader} role="row">
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.column-resource">Resource</Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.column-total">Total</Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.column-git-sync">Git Sync</Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.column-other">Other</Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.column-unmanaged">Unmanaged</Trans>
          </Text>
        </div>
        {visible.map((b) => (
          <div key={`${b.group}/${b.resource}`} className={styles.allResourcesRow} role="row">
            <Stack direction="row" gap={1} alignItems="center">
              <Text>{b.label}</Text>
              {b.isGitSyncSupported && (
                <Text color="secondary" variant="bodySmall">
                  <Trans i18nKey="provisioning.stats.git-sync-supported-label">Supported</Trans>
                </Text>
              )}
            </Stack>
            <Text>{b.total.toLocaleString()}</Text>
            <Text color={b.gitSyncCount > 0 ? 'success' : 'secondary'}>{b.gitSyncCount.toLocaleString()}</Text>
            <Text color={b.otherManagedCount > 0 ? 'info' : 'secondary'}>{b.otherManagedCount.toLocaleString()}</Text>
            <Text color={b.unmanagedCount > 0 ? 'warning' : 'secondary'}>{b.unmanagedCount.toLocaleString()}</Text>
          </div>
        ))}
      </div>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Stack direction="column" gap={0}>
      <Text variant="h4">{value.toLocaleString()}</Text>
      <Text color="secondary" variant="bodySmall">
        {label}
      </Text>
    </Stack>
  );
}

export function StatsTabContent() {
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();

  const computed = useMemo(() => computeStats(data), [data]);

  if (isLoading) {
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <Spinner />
        <Trans i18nKey="provisioning.stats.loading">Loading stats...</Trans>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" title={t('provisioning.stats.error-title', 'Failed to load provisioning stats')}>
        {getErrorMessage(error)}
      </Alert>
    );
  }

  if (!data || computed.instanceTotal === 0) {
    return <EmptyState variant="not-found" message={t('provisioning.stats.empty', 'No provisioned resources yet')} />;
  }

  return (
    <Stack direction="column" gap={4}>
      <SummarySection stats={computed} />
      <MigrationReadinessSection breakdowns={computed.groupBreakdowns} />
      {computed.gitSync && <GitSyncReposSection gitSync={computed.gitSync} />}
      <OtherProvidersSection providers={computed.otherProviders} />
      <AllResourcesSection breakdowns={computed.groupBreakdowns} />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  summaryCard: css({
    flex: '1 1 0',
    minWidth: 160,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  bar: css({
    display: 'flex',
    width: '100%',
    height: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    background: theme.colors.background.secondary,
  }),
  legendDotSuccess: css({
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.success.main,
  }),
  legendDotInfo: css({
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.info.main,
  }),
  legendDotWarning: css({
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.warning.main,
  }),
  allResourcesGrid: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))',
    rowGap: theme.spacing(1),
    columnGap: theme.spacing(2),
  }),
  allResourcesHeader: css({
    display: 'contents',
  }),
  allResourcesRow: css({
    display: 'contents',
  }),
});
