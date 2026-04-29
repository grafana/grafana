import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Card, EmptyState, Icon, Spinner, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import {
  type ManagerStats,
  type ResourceCount,
  type ResourceStats,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';

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
  /** Counts of resources managed by each non-Git-Sync manager kind. */
  managedByKind: Record<string, number>;
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
        managedByKind: {},
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
    const kind = m.kind ?? '';
    const isGitSync = kind === ManagerKind.Repo;
    m.stats.forEach((s) => {
      const entry = ensure(s.group, s.resource);
      if (isGitSync) {
        entry.gitSyncCount += s.count;
      } else {
        entry.otherManagedCount += s.count;
        entry.managedByKind[kind] = (entry.managedByKind[kind] ?? 0) + s.count;
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

function Donut({
  gitSync,
  other,
  unmanaged,
  size = 96,
  strokeWidth = 14,
  centerLabel,
  centerSubLabel,
}: {
  gitSync: number;
  other: number;
  unmanaged: number;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}) {
  const theme = useTheme2();
  const total = gitSync + other + unmanaged;
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { value: gitSync, color: theme.colors.success.main },
    { value: other, color: theme.colors.info.main },
    { value: unmanaged, color: theme.colors.warning.main },
  ].filter((s) => s.value > 0);

  let cumulative = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={theme.colors.background.secondary}
        strokeWidth={strokeWidth}
      />
      {total > 0 &&
        segments.map((seg, idx) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const offset = -cumulative * circumference;
          cumulative += pct;
          return (
            <circle
              key={idx}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              strokeLinecap="butt"
            />
          );
        })}
      {centerLabel !== undefined && (
        <text
          x="50"
          y={centerSubLabel ? 46 : 50}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="20"
          fontWeight={600}
          fill={theme.colors.text.primary}
        >
          {centerLabel}
        </text>
      )}
      {centerSubLabel && (
        <text
          x="50"
          y="62"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="9"
          fill={theme.colors.text.secondary}
        >
          {centerSubLabel}
        </text>
      )}
    </svg>
  );
}

function SummarySection({ stats }: { stats: ComputedStats }) {
  const styles = useStyles2(getStyles);
  const gitSyncTotal = stats.gitSync?.totals.total ?? 0;
  const otherTotal = stats.otherProviders.reduce((acc, p) => acc + p.totals.total, 0);
  const managedPct = percent(stats.managedTotal, stats.instanceTotal);
  return (
    <Stack direction="column" gap={1}>
      <Text variant="h5">
        <Trans i18nKey="provisioning.stats.summary-headline" values={{ pct: managedPct }}>
          {'{{pct}}'} of resources are provisioned as code
        </Trans>
      </Text>
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="provisioning.stats.summary-subhead">
          A resource is provisioned as code when a tool like Git Sync, Terraform, or kubectl manages it.
        </Trans>
      </Text>
      <div className={styles.summaryPanel}>
        <div className={styles.summaryDonut}>
          <Donut
            gitSync={gitSyncTotal}
            other={otherTotal}
            unmanaged={stats.unmanagedTotal}
            size={140}
            strokeWidth={18}
            centerLabel={managedPct}
            centerSubLabel={t('provisioning.stats.donut-center-sublabel', 'as code')}
          />
        </div>
        <Stack direction="row" gap={2} wrap flex={1}>
          <PercentageStat
            big={stats.instanceTotal.toLocaleString()}
            label={t('provisioning.stats.summary-total', 'Total resources')}
            dotClass={undefined}
          />
          <PercentageStat
            big={percent(gitSyncTotal, stats.instanceTotal)}
            subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
              value: gitSyncTotal,
              total: stats.instanceTotal,
            })}
            label={t('provisioning.stats.legend-git-sync', 'Managed by Git Sync')}
            dotClass={styles.legendDotSuccess}
            color="success"
          />
          <PercentageStat
            big={percent(otherTotal, stats.instanceTotal)}
            subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
              value: otherTotal,
              total: stats.instanceTotal,
            })}
            label={t('provisioning.stats.legend-other', 'Managed by other tools')}
            dotClass={styles.legendDotInfo}
            color="info"
          />
          <PercentageStat
            big={percent(stats.unmanagedTotal, stats.instanceTotal)}
            subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
              value: stats.unmanagedTotal,
              total: stats.instanceTotal,
            })}
            label={t('provisioning.stats.legend-unmanaged', 'Unmanaged')}
            dotClass={styles.legendDotWarning}
            color="warning"
          />
        </Stack>
      </div>
    </Stack>
  );
}

function PercentageStat({
  big,
  subLabel,
  label,
  dotClass,
  color,
}: {
  big: string;
  subLabel?: string;
  label: string;
  dotClass: string | undefined;
  color?: 'success' | 'info' | 'warning';
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.percentStat}>
      <Text variant="h1" color={color}>
        {big}
      </Text>
      {subLabel && (
        <Text color="secondary" variant="bodySmall">
          {subLabel}
        </Text>
      )}
      <Stack direction="row" gap={1} alignItems="center">
        {dotClass && <span className={dotClass} />}
        <Text color="secondary" variant="bodySmall">
          {label}
        </Text>
      </Stack>
    </div>
  );
}

function FoldersAndDashboardsSection({ breakdowns }: { breakdowns: GroupBreakdown[] }) {
  const supported = breakdowns.filter((b) => b.isGitSyncSupported);
  if (supported.length === 0) {
    return null;
  }

  const totalSupported = supported.reduce((acc, b) => acc + b.total, 0);
  const gitSyncCovered = supported.reduce((acc, b) => acc + b.gitSyncCount, 0);
  const totalEligible = supported.reduce((acc, b) => acc + b.unmanagedCount, 0);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="apps" />
        <Text variant="h3">
          <Trans i18nKey="provisioning.stats.folders-dashboards-heading">Folders and dashboards</Trans>
        </Text>
      </Stack>
      <Text color="secondary">
        <Trans i18nKey="provisioning.stats.folders-dashboards-description">
          How folders and dashboards are currently managed. Git Sync supports these types; other tools (Terraform,
          kubectl, plugins, etc.) can also manage them.
        </Trans>
      </Text>
      <GitSyncCoverageCard gitSyncCovered={gitSyncCovered} totalSupported={totalSupported} />
      {totalEligible > 0 && (
        <Alert
          severity="info"
          title={t('provisioning.stats.unmanaged-callout-title', 'Some folders or dashboards aren’t managed yet')}
        >
          <Trans i18nKey="provisioning.stats.unmanaged-callout-description" count={totalEligible}>
            {{ count: totalEligible }} folder or dashboard isn’t managed by any provider. You can bring them under Git
            Sync, Terraform, or another tool.
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

function GitSyncCoverageCard({ gitSyncCovered, totalSupported }: { gitSyncCovered: number; totalSupported: number }) {
  const styles = useStyles2(getStyles);
  if (totalSupported === 0) {
    // Nothing to manage yet — avoid showing a 0 / 0 stat that reads like an error.
    return null;
  }
  const coveragePct = percent(gitSyncCovered, totalSupported);
  return (
    <div className={styles.gitSyncCard}>
      <Stack direction="row" gap={3} alignItems="center" wrap>
        <div className={styles.gitSyncHeadline}>
          <Text variant="h1" color="success">
            {coveragePct}
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.git-sync-coverage-detail">
              {{ covered: gitSyncCovered }} of {{ total: totalSupported }} via Git Sync
            </Trans>
          </Text>
        </div>
        <Stack direction="column" gap={0.5} flex={1}>
          <Text variant="h5">
            <Trans i18nKey="provisioning.stats.git-sync-encourage-title">
              Git Sync is the simplest way to manage folders and dashboards as code
            </Trans>
          </Text>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="provisioning.stats.git-sync-encourage-description">
              Connect a repository and your folders and dashboards stay versioned automatically — every save becomes a
              commit.
            </Trans>
          </Text>
        </Stack>
        <ConnectRepositoryButton />
      </Stack>
    </div>
  );
}

function ResourceBreakdownCard({ breakdown }: { breakdown: GroupBreakdown }) {
  const styles = useStyles2(getStyles);
  const nOfM = (value: number) =>
    t('provisioning.stats.n-of-m', '{{value}} of {{total}}', { value, total: breakdown.total });
  const otherEntries = Object.entries(breakdown.managedByKind).filter(([, count]) => count > 0);
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
        <Stack direction="column" gap={2}>
          <Stack direction="row" gap={3} alignItems="center" wrap>
            <Donut
              gitSync={breakdown.gitSyncCount}
              other={breakdown.otherManagedCount}
              unmanaged={breakdown.unmanagedCount}
              size={88}
              strokeWidth={14}
              centerLabel={percent(breakdown.gitSyncCount + breakdown.otherManagedCount, breakdown.total)}
            />
            <Stack direction="row" gap={3} wrap flex={1}>
              <PercentageStat
                big={percent(breakdown.gitSyncCount, breakdown.total)}
                subLabel={nOfM(breakdown.gitSyncCount)}
                label={t('provisioning.stats.legend-git-sync', 'Managed by Git Sync')}
                dotClass={styles.legendDotSuccess}
                color="success"
              />
              <PercentageStat
                big={percent(breakdown.otherManagedCount, breakdown.total)}
                subLabel={nOfM(breakdown.otherManagedCount)}
                label={t('provisioning.stats.legend-other', 'Managed by other tools')}
                dotClass={styles.legendDotInfo}
                color="info"
              />
              <PercentageStat
                big={percent(breakdown.unmanagedCount, breakdown.total)}
                subLabel={nOfM(breakdown.unmanagedCount)}
                label={t('provisioning.stats.legend-unmanaged', 'Unmanaged')}
                dotClass={styles.legendDotWarning}
                color="warning"
              />
            </Stack>
          </Stack>
          {otherEntries.length > 0 && (
            <Stack direction="row" gap={1} alignItems="center" wrap>
              <Text color="secondary" variant="bodySmall">
                <Trans i18nKey="provisioning.stats.managed-by-prefix">Managed by:</Trans>
              </Text>
              {otherEntries.map(([kind, count]) => (
                <span key={kind} className={styles.kindChip}>
                  <Text variant="bodySmall">
                    {kindLabel(kind)} · {count}
                  </Text>
                </span>
              ))}
            </Stack>
          )}
        </Stack>
      </Card.Description>
    </Card>
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
        <Text variant="h4">
          <Trans i18nKey="provisioning.stats.other-providers-heading">Other providers</Trans>
        </Text>
      </Stack>
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="provisioning.stats.other-providers-description">
          Resources managed by tools other than Git Sync. Some of these (Terraform, kubectl, etc.) may already be the
          source of truth for your team — Git Sync isn’t a requirement.
        </Trans>
      </Text>
      <Stack direction="column" gap={1}>
        {providers.map((p) => (
          <Card noMargin key={p.kind}>
            <Card.Heading>
              <Stack direction="row" gap={2} alignItems="baseline">
                <Text variant="h5">{kindLabel(p.kind)}</Text>
                <Text variant="bodySmall" color="secondary">
                  {t('provisioning.stats.other-provider-resource-count', '{{count}} resource', {
                    count: p.totals.total,
                  })}
                </Text>
              </Stack>
            </Card.Heading>
            <Card.Description>
              <ManagerIdentityList managers={p.managers} />
            </Card.Description>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function ManagerIdentityList({
  managers,
}: {
  managers: Array<{ id: string; total: number; folders: number; dashboards: number }>;
}) {
  const styles = useStyles2(getStyles);
  if (managers.length === 0) {
    return null;
  }
  return (
    <div className={styles.managerList}>
      {managers.map((m, index) => (
        <div key={m.id || `manager-${index}`} className={styles.managerRow}>
          <Text>{m.id || t('provisioning.stats.manager-fallback-name', 'Unnamed manager')}</Text>
          <Stack direction="row" gap={2} wrap>
            {m.folders > 0 && (
              <Text color="secondary" variant="bodySmall">
                {t('provisioning.stats.folders-count', '{{count}} folder', { count: m.folders })}
              </Text>
            )}
            {m.dashboards > 0 && (
              <Text color="secondary" variant="bodySmall">
                {t('provisioning.stats.dashboards-count', '{{count}} dashboard', { count: m.dashboards })}
              </Text>
            )}
            <Text color="secondary" variant="bodySmall">
              {t('provisioning.stats.resource-total', '{{count}} total', { count: m.total })}
            </Text>
          </Stack>
        </div>
      ))}
    </div>
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
      <FoldersAndDashboardsSection breakdowns={computed.groupBreakdowns} />
      {computed.gitSync && <GitSyncReposSection gitSync={computed.gitSync} />}
      <OtherProvidersSection providers={computed.otherProviders} />
      <AllResourcesSection breakdowns={computed.groupBreakdowns} />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  summaryPanel: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  summaryDonut: css({
    flex: '0 0 auto',
  }),
  percentStat: css({
    flex: '1 1 140px',
    minWidth: 120,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  gitSyncCard: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(2, 3),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.success.borderTransparent}`,
    background: theme.colors.success.transparent,
  }),
  gitSyncHeadline: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    minWidth: 110,
  }),
  kindChip: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  managerList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  managerRow: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    '&:first-child': {
      borderTop: 'none',
    },
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
