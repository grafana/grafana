import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Card, EmptyState, Icon, Select, Spinner, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
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

const CLASSIC_FILE_PROVISIONING = 'classic-file-provisioning';
const GRAFANA_INTERNAL = 'grafana';

/**
 * What each provisioning manager can manage. Sourced from the Grafana docs
 * (`docs/sources/`) and the supported-resources lists in
 * `pkg/registry/apis/provisioning/resources/client.go`. Use `'*'` for
 * managers that can manage anything exposed via the Grafana Kubernetes API.
 */
const PROVIDER_SUPPORT: Record<string, { groups: string[] | '*' }> = {
  [ManagerKind.Repo]: {
    groups: GIT_SYNC_SUPPORTED_GROUPS,
  },
  [CLASSIC_FILE_PROVISIONING]: {
    // YAML/JSON config under `provisioning/`: dashboards, datasources,
    // alerting, access control. Deprecated path; documented in
    // docs/sources/administration/provisioning/.
    groups: [...DASHBOARD_GROUPS, 'datasource.grafana.app', 'alerting.grafana.app', 'access-control.grafana.app'],
  },
  [ManagerKind.Terraform]: {
    // Grafana Terraform provider — broad coverage of Grafana resources.
    groups: [
      ...FOLDER_GROUPS,
      ...DASHBOARD_GROUPS,
      'datasource.grafana.app',
      'alerting.grafana.app',
      'notifications.grafana.app',
    ],
  },
  [ManagerKind.Kubectl]: {
    // The Kubernetes API surface covers any Grafana K8s-native resource.
    groups: '*',
  },
  [ManagerKind.Plugin]: {
    // Plugin-bundled resources are typically dashboards.
    groups: DASHBOARD_GROUPS,
  },
  [GRAFANA_INTERNAL]: {
    // Internal Grafana-managed resources (system roles etc.); not surfaced
    // to users in this view.
    groups: [],
  },
};

function providerSupports(kind: string, group: string): boolean {
  const support = PROVIDER_SUPPORT[kind];
  if (!support) {
    return false;
  }
  if (support.groups === '*') {
    return true;
  }
  return support.groups.includes(group);
}

function providersThatSupport(group: string): string[] {
  return Object.entries(PROVIDER_SUPPORT)
    .filter(([, info]) => info.groups === '*' || info.groups.includes(group))
    .map(([kind]) => kind);
}

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

interface ProviderSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

function colorForKind(theme: GrafanaTheme2, kind: string): string {
  switch (kind) {
    case ManagerKind.Repo:
      return theme.colors.success.main;
    case ManagerKind.Terraform:
      return theme.visualization.getColorByName('blue');
    case ManagerKind.Kubectl:
      return theme.visualization.getColorByName('purple');
    case ManagerKind.Plugin:
      return theme.visualization.getColorByName('yellow');
    case CLASSIC_FILE_PROVISIONING:
      return theme.visualization.getColorByName('red');
    case GRAFANA_INTERNAL:
      return theme.colors.text.disabled;
    default:
      return theme.colors.text.secondary;
  }
}

function buildSegments(stats: ComputedStats, theme: GrafanaTheme2): ProviderSegment[] {
  const segments: ProviderSegment[] = [];
  if (stats.gitSync && stats.gitSync.totals.total > 0) {
    segments.push({
      key: ManagerKind.Repo,
      label: kindLabel(ManagerKind.Repo),
      value: stats.gitSync.totals.total,
      color: theme.colors.success.main,
    });
  }
  for (const p of stats.otherProviders) {
    if (p.totals.total === 0) {
      continue;
    }
    segments.push({
      key: p.kind,
      label: kindLabel(p.kind),
      value: p.totals.total,
      color: colorForKind(theme, p.kind),
    });
  }
  if (stats.unmanagedTotal > 0) {
    segments.push({
      key: 'unmanaged',
      label: t('provisioning.stats.legend-unmanaged', 'Unmanaged'),
      value: stats.unmanagedTotal,
      color: theme.colors.warning.main,
    });
  }
  return segments;
}

function Donut({
  segments,
  size = 140,
  strokeWidth = 18,
  centerLabel,
  centerSubLabel,
  hoveredKey,
  onHover,
}: {
  segments: ProviderSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
  hoveredKey: string | null;
  onHover: (key: string | null) => void;
}) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img">
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={theme.colors.background.secondary}
        strokeWidth={strokeWidth}
      />
      {total > 0 &&
        segments.map((seg) => {
          const pct = seg.value / total;
          const dashLen = pct * circumference;
          const offset = -cumulative * circumference;
          cumulative += pct;
          const isHovered = hoveredKey === seg.key;
          const isOtherHovered = hoveredKey !== null && hoveredKey !== seg.key;
          return (
            <circle
              key={seg.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
              strokeLinecap="butt"
              onMouseEnter={() => onHover(seg.key)}
              onMouseLeave={() => onHover(null)}
              className={styles.donutSegment}
              style={{ opacity: isOtherHovered ? 0.35 : 1 }}
            >
              <title>{`${seg.label}: ${seg.value} (${Math.round(pct * 100)}%)`}</title>
            </circle>
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
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const segments = useMemo(() => buildSegments(stats, theme), [stats, theme]);
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
            segments={segments}
            size={140}
            strokeWidth={18}
            centerLabel={managedPct}
            centerSubLabel={t('provisioning.stats.donut-center-sublabel', 'as code')}
            hoveredKey={hoveredKey}
            onHover={setHoveredKey}
          />
        </div>
        <Stack direction="row" gap={1.5} wrap flex={1}>
          <ProviderStat
            segmentKey="total"
            big={stats.instanceTotal.toLocaleString()}
            label={t('provisioning.stats.summary-total', 'Total resources')}
            hoveredKey={hoveredKey}
            onHover={setHoveredKey}
          />
          {segments.map((seg) => (
            <ProviderStat
              key={seg.key}
              segmentKey={seg.key}
              big={percent(seg.value, stats.instanceTotal)}
              subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
                value: seg.value,
                total: stats.instanceTotal,
              })}
              label={seg.label}
              colorHex={seg.color}
              hoveredKey={hoveredKey}
              onHover={setHoveredKey}
            />
          ))}
        </Stack>
      </div>
    </Stack>
  );
}

function ProviderStat({
  segmentKey,
  big,
  subLabel,
  label,
  colorHex,
  hoveredKey,
  onHover,
}: {
  segmentKey: string;
  big: string;
  subLabel?: string;
  label: string;
  colorHex?: string;
  hoveredKey: string | null;
  onHover: (key: string | null) => void;
}) {
  const styles = useStyles2(getStyles);
  const isHovered = hoveredKey === segmentKey;
  const isDimmed = hoveredKey !== null && hoveredKey !== segmentKey;
  return (
    <div
      className={cx(styles.providerStat, isHovered && styles.providerStatHover, isDimmed && styles.providerStatDim)}
      onMouseEnter={() => onHover(segmentKey)}
      onMouseLeave={() => onHover(null)}
    >
      <span className={styles.providerStatBig} style={colorHex ? { color: colorHex } : undefined}>
        {big}
      </span>
      {subLabel && (
        <Text color="secondary" variant="bodySmall">
          {subLabel}
        </Text>
      )}
      <Stack direction="row" gap={1} alignItems="center">
        {colorHex && <span className={styles.providerStatDot} style={{ background: colorHex }} />}
        <Text color="secondary" variant="bodySmall">
          {label}
        </Text>
      </Stack>
    </div>
  );
}

function GitSyncBanner({ breakdowns }: { breakdowns: GroupBreakdown[] }) {
  const supported = breakdowns.filter((b) => b.isGitSyncSupported);
  const totalSupported = supported.reduce((acc, b) => acc + b.total, 0);
  if (totalSupported === 0) {
    // No folders or dashboards to manage yet — skip the banner so we don't
    // promote a CTA before the user has anything to point it at.
    return null;
  }
  const gitSyncCovered = supported.reduce((acc, b) => acc + b.gitSyncCount, 0);

  return (
    <Alert
      severity="info"
      title={t(
        'provisioning.stats.git-sync-banner-title',
        '{{covered}} of {{total}} folders and dashboards are managed by Git Sync',
        { covered: gitSyncCovered, total: totalSupported }
      )}
      action={<ConnectRepositoryButton />}
    >
      <Trans i18nKey="provisioning.stats.git-sync-banner-body">
        Git Sync is the simplest way to manage folders and dashboards as code — connect a repository and every change
        gets versioned automatically. Other tools like Terraform or kubectl work too.
      </Trans>
    </Alert>
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

function ResourceTypesSection({ breakdowns }: { breakdowns: GroupBreakdown[] }) {
  const styles = useStyles2(getStyles);
  const [providerFilter, setProviderFilter] = useState<string>('all');

  // Drop seeded zero-count rows so we don't list types nobody has any of.
  const baseRows = useMemo(() => breakdowns.filter((b) => b.total > 0), [breakdowns]);

  const filterOptions: Array<SelectableValue<string>> = useMemo(
    () => [
      { value: 'all', label: t('provisioning.stats.filter-all', 'All providers') },
      ...Object.keys(PROVIDER_SUPPORT).map((kind) => ({ value: kind, label: kindLabel(kind) })),
    ],
    []
  );

  const rows = useMemo(() => {
    if (providerFilter === 'all') {
      return baseRows;
    }
    return baseRows.filter((b) => providerSupports(providerFilter, b.group));
  }, [baseRows, providerFilter]);

  if (baseRows.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Icon name="list-ul" />
        <Text variant="h4">
          <Trans i18nKey="provisioning.stats.resource-types-heading">Resource types</Trans>
        </Text>
      </Stack>
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="provisioning.stats.resource-types-description">
          Each provisioning tool supports a different set of resource types — pick one to see only what it can manage.
        </Trans>
      </Text>
      <Stack direction="row" gap={1} alignItems="center">
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="provisioning.stats.filter-label">Show types supported by</Trans>
        </Text>
        <div className={styles.providerSelect}>
          <Select
            value={providerFilter}
            options={filterOptions}
            onChange={(v) => setProviderFilter(v.value ?? 'all')}
            aria-label={t('provisioning.stats.filter-aria-label', 'Filter resource types by provider')}
          />
        </div>
      </Stack>
      {rows.length === 0 ? (
        <Alert
          severity="info"
          title={t(
            'provisioning.stats.filter-empty-title',
            '{{provider}} doesn’t manage any of your current resources',
            {
              provider: kindLabel(providerFilter),
            }
          )}
        />
      ) : (
        <div className={styles.otherResourcesGrid} role="table">
          <div className={styles.otherResourcesHeader} role="row">
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="provisioning.stats.column-resource">Resource</Trans>
            </Text>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="provisioning.stats.column-total">Total</Trans>
            </Text>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="provisioning.stats.column-managed">Managed</Trans>
            </Text>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="provisioning.stats.column-unmanaged">Unmanaged</Trans>
            </Text>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="provisioning.stats.column-supported-by">Supported by</Trans>
            </Text>
          </div>
          {rows.map((b) => (
            <div key={`${b.group}/${b.resource}`} className={styles.otherResourcesRow} role="row">
              <Text>{b.label}</Text>
              <Text>{b.total.toLocaleString()}</Text>
              <Text color={b.otherManagedCount > 0 ? 'info' : 'secondary'}>{b.otherManagedCount.toLocaleString()}</Text>
              <Text color={b.unmanagedCount > 0 ? 'warning' : 'secondary'}>{b.unmanagedCount.toLocaleString()}</Text>
              <Stack direction="row" gap={0.5} wrap>
                {providersThatSupport(b.group).map((kind) => (
                  <span key={kind} className={styles.kindChip}>
                    <Text variant="bodySmall">{kindLabel(kind)}</Text>
                  </span>
                ))}
              </Stack>
            </div>
          ))}
        </div>
      )}
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
      <GitSyncBanner breakdowns={computed.groupBreakdowns} />
      {computed.gitSync && <GitSyncReposSection gitSync={computed.gitSync} />}
      <OtherProvidersSection providers={computed.otherProviders} />
      <ResourceTypesSection breakdowns={computed.groupBreakdowns} />
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
  providerStat: css({
    flex: '1 1 140px',
    minWidth: 120,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid transparent`,
    cursor: 'default',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'background 150ms ease, border-color 150ms ease, opacity 150ms ease',
    },
  }),
  providerStatHover: css({
    background: theme.colors.background.canvas,
    borderColor: theme.colors.border.medium,
  }),
  providerStatDim: css({
    opacity: 0.55,
  }),
  providerStatBig: css({
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    lineHeight: 1.1,
  }),
  providerStatDot: css({
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: theme.shape.radius.circle,
  }),
  donutSegment: css({
    cursor: 'pointer',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'opacity 150ms ease, stroke-width 150ms ease',
    },
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
  otherResourcesGrid: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 0.6fr) minmax(0, 0.6fr) minmax(0, 0.6fr) minmax(0, 2fr)',
    rowGap: theme.spacing(1),
    columnGap: theme.spacing(2),
    alignItems: 'center',
  }),
  otherResourcesHeader: css({
    display: 'contents',
  }),
  otherResourcesRow: css({
    display: 'contents',
  }),
  providerSelect: css({
    minWidth: 220,
  }),
});
