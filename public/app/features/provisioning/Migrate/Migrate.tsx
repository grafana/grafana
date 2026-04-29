import { css, cx, keyframes } from '@emotion/css';
import { useMemo } from 'react';

import { FeatureState, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Alert,
  type Column,
  EmptyState,
  FeatureBadge,
  Icon,
  type IconName,
  InteractiveTable,
  LinkButton,
  Spinner,
  Stack,
  Text,
  TextLink,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import {
  type ManagerStats,
  type Repository,
  type ResourceStats,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

import { CONFIGURE_GRAFANA_DOCS_URL, GETTING_STARTED_URL, PROVISIONING_URL } from '../constants';
import { useRepositoryList } from '../hooks/useRepositoryList';
import gitSvg from '../img/git.svg';

const FOLDER_GROUPS = ['folder.grafana.app', 'folders'];
const DASHBOARD_GROUPS = ['dashboard.grafana.app'];

const CLASSIC_FILE_PROVISIONING = 'classic-file-provisioning';

interface SupportedTool {
  key: string;
  /** Manager kind reported by the backend; what we group counts under. */
  kind: string;
  label: string;
  /** Short tagline describing what the tool is for, shown under the label. */
  description: string;
  /** Static SVG asset (e.g. the Git logo). Takes precedence over `icon`/`initial`. */
  image?: string;
  /** Grafana UI icon name. Takes precedence over `initial`. */
  icon?: IconName;
  /** Last-resort placeholder rendered as a big letter inside the tile. */
  initial?: string;
  recommended?: boolean;
}

/**
 * Tools that can manage folders or dashboards. Order is the order tiles
 * appear; Git Sync is intentionally first because it's the recommended
 * starting point.
 */
const SUPPORTED_TOOLS: SupportedTool[] = [
  {
    key: 'git-sync',
    kind: ManagerKind.Repo,
    label: 'Git Sync',
    description: 'Sync folders and dashboards from a Git repository.',
    image: gitSvg,
    recommended: true,
  },
  {
    key: 'file-system',
    kind: CLASSIC_FILE_PROVISIONING,
    label: 'File System',
    description: 'Provision from local YAML or JSON files on the Grafana host.',
    icon: 'file-alt',
  },
  {
    key: 'terraform',
    kind: ManagerKind.Terraform,
    label: 'Terraform',
    description: 'Manage Grafana resources as Terraform infrastructure.',
    initial: 'T',
  },
  {
    key: 'cli',
    kind: ManagerKind.Kubectl,
    label: 'CLI',
    description: 'Apply manifests with kubectl, gcx, or grafanactl.',
    initial: 'C',
  },
];

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
}

function resourceLabel(group: string): string {
  if (FOLDER_GROUPS.includes(group)) {
    return t('provisioning.stats.folders', 'Folders');
  }
  if (DASHBOARD_GROUPS.includes(group)) {
    return t('provisioning.stats.dashboards', 'Dashboards');
  }
  return group;
}

function resourceIcon(group: string): IconName {
  if (FOLDER_GROUPS.includes(group)) {
    return 'folder';
  }
  if (DASHBOARD_GROUPS.includes(group)) {
    return 'apps';
  }
  return 'database';
}

/**
 * Build per-type breakdowns for Folders and Dashboards from the API
 * response. Always emits one row per type even when the API doesn't
 * report any, so the table reads consistently.
 */
function computeBreakdowns(data?: ResourceStats): GroupBreakdown[] {
  const seedKeys = ['folder.grafana.app', 'dashboard.grafana.app'];
  const seedResources: Record<string, string> = {
    'folder.grafana.app': 'folders',
    'dashboard.grafana.app': 'dashboards',
  };

  const map = new Map<string, GroupBreakdown>();
  for (const group of seedKeys) {
    map.set(group, {
      group,
      resource: seedResources[group],
      label: resourceLabel(group),
      total: 0,
      gitSyncCount: 0,
      otherManagedCount: 0,
      managedByKind: {},
      unmanagedCount: 0,
    });
  }

  data?.instance?.forEach((c) => {
    // Fold legacy `folders` group into folder.grafana.app for display.
    const key = FOLDER_GROUPS.includes(c.group) ? 'folder.grafana.app' : c.group;
    const entry = map.get(key);
    if (entry) {
      entry.total += c.count;
    }
  });

  data?.managed?.forEach((m: ManagerStats) => {
    const kind = m.kind ?? '';
    const isGitSync = kind === ManagerKind.Repo;
    m.stats.forEach((s) => {
      const key = FOLDER_GROUPS.includes(s.group) ? 'folder.grafana.app' : s.group;
      const entry = map.get(key);
      if (!entry) {
        return;
      }
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

  return Array.from(map.values());
}

function aggregateTotals(breakdowns: GroupBreakdown[]) {
  let instanceTotal = 0;
  let managed = 0;
  let unmanaged = 0;
  let gitSync = 0;
  breakdowns.forEach((b) => {
    instanceTotal += b.total;
    gitSync += b.gitSyncCount;
    managed += b.gitSyncCount + b.otherManagedCount;
    unmanaged += b.unmanagedCount;
  });
  return { instanceTotal, managed, unmanaged, gitSync };
}

function kindLabel(kind: string): string {
  switch (kind) {
    case ManagerKind.Repo:
      return t('provisioning.stats.manager-kind-repo', 'Git Sync');
    case ManagerKind.Terraform:
      return t('provisioning.stats.manager-kind-terraform', 'Terraform');
    case ManagerKind.Kubectl:
      return t('provisioning.stats.manager-kind-cli', 'CLI');
    case ManagerKind.Plugin:
      return t('provisioning.stats.manager-kind-plugin', 'Plugin');
    case CLASSIC_FILE_PROVISIONING:
      return t('provisioning.stats.manager-kind-file-system', 'File System');
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

function rowKey(b: GroupBreakdown): string {
  return `${b.group}/${b.resource}`;
}

function migrateTarget(repos: Repository[]): string {
  if (repos.length === 0) {
    return GETTING_STARTED_URL;
  }
  if (repos.length === 1 && repos[0].metadata?.name) {
    return `${PROVISIONING_URL}/${repos[0].metadata.name}`;
  }
  return PROVISIONING_URL;
}

function CoverageBar({
  covered,
  total,
  showRange = false,
  compact = false,
}: {
  covered: number;
  total: number;
  showRange?: boolean;
  compact?: boolean;
}) {
  const styles = useStyles2(getStyles);
  const pct = total === 0 ? 0 : Math.max(0, Math.min(100, (covered / total) * 100));
  const hue = 30 + (pct / 100) * 90;
  const fillColor = `hsl(${hue}, 70%, 45%)`;
  const tooltip = t('provisioning.stats.coverage-bar-tooltip', '{{covered}} of {{total}} ({{pct}}%)', {
    covered,
    total,
    pct: Math.round(pct),
  });
  const bar = (
    <div
      className={cx(styles.coverageTrack, compact && styles.coverageTrackCompact)}
      role="img"
      aria-label={t('provisioning.stats.coverage-bar-aria', 'Coverage progress')}
      title={tooltip}
    >
      <div className={styles.coverageFill} style={{ width: `${pct}%`, background: fillColor }} />
    </div>
  );
  if (!showRange) {
    return bar;
  }
  return (
    <div className={styles.coverageRow}>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="provisioning.stats.coverage-bar-start">0%</Trans>
      </Text>
      <div className={styles.coverageBarFlex}>{bar}</div>
      <Text variant="bodySmall" color="secondary">
        <Trans i18nKey="provisioning.stats.coverage-bar-end">100%</Trans>
      </Text>
    </div>
  );
}

interface DonutSegment {
  key: string;
  value: number;
  color: string;
  label: string;
}

function Donut({
  segments,
  size = 140,
  strokeWidth = 18,
  centerLabel,
  centerSubLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}) {
  const theme = useTheme2();
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
        stroke={theme.colors.background.canvas}
        strokeWidth={strokeWidth}
      />
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((seg) => {
            const pct = seg.value / total;
            const dashLen = pct * circumference;
            const offset = -cumulative * circumference;
            cumulative += pct;
            return (
              <circle
                key={seg.key}
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
          y="63"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="11"
          fill={theme.colors.text.secondary}
        >
          {centerSubLabel}
        </text>
      )}
    </svg>
  );
}

function colorForGroup(theme: GrafanaTheme2, group: string): string {
  if (FOLDER_GROUPS.includes(group)) {
    return theme.visualization.getColorByName('yellow');
  }
  if (DASHBOARD_GROUPS.includes(group)) {
    return theme.visualization.getColorByName('blue');
  }
  return theme.colors.text.secondary;
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
    default:
      return theme.colors.text.secondary;
  }
}

function EmptyDonut({ size = 140, strokeWidth = 18 }: { size?: number; strokeWidth?: number }) {
  const theme = useTheme2();
  const radius = 50 - strokeWidth / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={theme.colors.border.weak}
        strokeWidth={strokeWidth}
        strokeDasharray="2 3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ManagedByToolPanel({ breakdowns }: { breakdowns: GroupBreakdown[] }) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const segments: DonutSegment[] = useMemo(() => {
    const counts = new Map<string, number>();
    breakdowns.forEach((b) => {
      counts.set(ManagerKind.Repo, (counts.get(ManagerKind.Repo) ?? 0) + b.gitSyncCount);
      Object.entries(b.managedByKind).forEach(([kind, c]) => {
        counts.set(kind, (counts.get(kind) ?? 0) + c);
      });
    });
    return Array.from(counts.entries())
      .filter(([, value]) => value > 0)
      .map(([kind, value]) => ({
        key: kind,
        value,
        label: kindLabel(kind),
        color: colorForKind(theme, kind),
      }));
  }, [breakdowns, theme]);

  const total = segments.reduce((acc, s) => acc + s.value, 0);

  return (
    <div className={styles.chartPanel}>
      <Text variant="h5">
        <Trans i18nKey="provisioning.stats.managed-by-tool-heading">Managed resources by tool</Trans>
      </Text>
      {total === 0 ? (
        <Stack direction="row" gap={2} alignItems="center">
          <div className={styles.emptyDonutWrap}>
            <EmptyDonut />
            <div className={styles.emptyDonutIcon}>
              <Icon name="rocket" size="xl" />
            </div>
          </div>
          <Stack direction="column" gap={0.5} flex={1}>
            <Text weight="medium">
              <Trans i18nKey="provisioning.stats.managed-by-tool-empty-title">
                An empty donut. For now.
              </Trans>
            </Text>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="provisioning.stats.managed-by-tool-empty-body">
                Connect Git Sync (or any other tool) and slices will appear here as folders and
                dashboards come under management.
              </Trans>
            </Text>
          </Stack>
        </Stack>
      ) : (
        <Stack direction="row" gap={2} alignItems="center">
          <Donut segments={segments} centerLabel={total.toLocaleString()} centerSubLabel={t('provisioning.stats.donut-center-managed', 'managed')} />
          <Stack direction="column" gap={1} flex={1}>
            {segments.map((s) => (
              <Stack key={s.key} direction="row" gap={1} alignItems="center">
                <span className={styles.legendDot} style={{ background: s.color }} aria-hidden />
                <Text variant="bodySmall" color="secondary">
                  {`${s.label}: ${s.value}`}
                </Text>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </div>
  );
}

function ResourceBreakdownPanel({
  breakdowns,
  variant,
}: {
  breakdowns: GroupBreakdown[];
  variant: 'managed' | 'unmanaged';
}) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const segments: DonutSegment[] = useMemo(
    () =>
      breakdowns
        .map((b) => ({
          key: b.group,
          value: variant === 'managed' ? b.gitSyncCount + b.otherManagedCount : b.unmanagedCount,
          color: colorForGroup(theme, b.group),
          label: b.label,
        }))
        .filter((s) => s.value > 0),
    [breakdowns, theme, variant]
  );

  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const heading =
    variant === 'managed'
      ? t('provisioning.stats.managed-by-type-heading', 'Managed by type')
      : t('provisioning.stats.unmanaged-by-type-heading', 'Unmanaged by type');
  const emptyText =
    variant === 'managed'
      ? t('provisioning.stats.managed-by-type-empty', 'No folders or dashboards are managed yet.')
      : t('provisioning.stats.unmanaged-by-type-empty', 'Everything is under management.');

  return (
    <div className={styles.chartPanel}>
      <Text variant="h5">{heading}</Text>
      {total === 0 ? (
        <Text variant="bodySmall" color="secondary">
          {emptyText}
        </Text>
      ) : (
        <Stack direction="row" gap={2} alignItems="center">
          <Donut segments={segments} centerLabel={total.toLocaleString()} />
          <Stack direction="column" gap={1} flex={1}>
            {segments.map((s) => (
              <Stack key={s.key} direction="row" gap={1} alignItems="center">
                <span className={styles.legendDot} style={{ background: s.color }} aria-hidden />
                <Text variant="bodySmall" color="secondary">
                  {`${s.label}: ${s.value}`}
                </Text>
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}
    </div>
  );
}

function MigrateToGitopsHeader() {
  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row" gap={1} alignItems="center">
        <Text element="h2" variant="h2">
          <Trans i18nKey="provisioning.stats.header-title">Migrate to GitOps</Trans>
        </Text>
        <FeatureBadge featureState={FeatureState.experimental} />
      </Stack>
      <Text color="secondary">
        <Trans i18nKey="provisioning.stats.header-subtitle">
          Manage your dashboards and folders like code — every change tracked, every update reviewed, every
          environment reproducible. Connect a Git repository to get started.
        </Trans>
      </Text>
    </Stack>
  );
}

type StatTone = 'neutral' | 'success' | 'info' | 'warning' | 'primary';

function StatCard({
  icon,
  tone,
  big,
  subLabel,
  label,
  emphasized,
}: {
  icon: IconName;
  tone: StatTone;
  big: string;
  subLabel?: string;
  label: string;
  emphasized?: boolean;
}) {
  const styles = useStyles2(getStyles);
  return (
    <div
      className={cx(
        styles.statCard,
        styles[`statCardSurface_${tone}` as const],
        emphasized && styles.statCardEmphasized
      )}
    >
      <div className={cx(styles.statCardIcon, styles[`statIconTone_${tone}` as const])}>
        <Icon name={icon} size="lg" />
      </div>
      <div className={styles.statCardBody}>
        <span className={cx(styles.statCardLabel, styles[`statCardTone_${tone}` as const])}>{label}</span>
        <Text variant="h2">{big}</Text>
        {subLabel && (
          <Text color="secondary" variant="bodySmall">
            {subLabel}
          </Text>
        )}
      </div>
    </div>
  );
}

function lastScanLabel(timestamp?: number): string {
  if (!timestamp) {
    return t('provisioning.stats.last-scan-unknown', 'Unknown');
  }
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return t('provisioning.stats.last-scan-just-now', 'Just now');
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return t('provisioning.stats.last-scan-minutes', '{{count}} min ago', { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('provisioning.stats.last-scan-hours', '{{count}} h ago', { count: hours });
  }
  const days = Math.floor(hours / 24);
  return t('provisioning.stats.last-scan-days', '{{count}} d ago', { count: days });
}

function OverviewStatCards({
  totals,
  lastScannedAt,
}: {
  totals: ReturnType<typeof aggregateTotals>;
  lastScannedAt?: number;
}) {
  const styles = useStyles2(getStyles);
  const progressSubLabel =
    totals.gitSync > 0
      ? t('provisioning.stats.progress-gitops-sub', '{{count}} via Git Sync', { count: totals.gitSync })
      : t('provisioning.stats.progress-gitops-sub-empty', 'Start your migration');
  const resourcesOf = (value: number) =>
    t('provisioning.stats.n-of-m-resources', '{{value}} of {{total}} resources', {
      value,
      total: totals.instanceTotal,
    });
  return (
    <div className={styles.statCardsRow}>
      <StatCard
        icon="cube"
        tone="info"
        big={totals.instanceTotal.toLocaleString()}
        subLabel={t('provisioning.stats.summary-total-sub', 'Across all providers')}
        label={t('provisioning.stats.summary-total', 'Total resources')}
      />
      <StatCard
        icon="check-circle"
        tone="success"
        big={percent(totals.managed, totals.instanceTotal)}
        subLabel={resourcesOf(totals.managed)}
        label={t('provisioning.stats.managed', 'Managed')}
      />
      <StatCard
        icon="exclamation-triangle"
        tone="warning"
        emphasized={totals.unmanaged > 0}
        big={percent(totals.unmanaged, totals.instanceTotal)}
        subLabel={resourcesOf(totals.unmanaged)}
        label={t('provisioning.stats.summary-unmanaged', 'Unmanaged')}
      />
      <StatCard
        icon="chart-line"
        tone="primary"
        big={percent(totals.gitSync, totals.instanceTotal)}
        subLabel={progressSubLabel}
        label={t('provisioning.stats.progress-gitops', 'Progress to GitOps')}
      />
      <StatCard
        icon="clock-nine"
        tone="neutral"
        big={lastScanLabel(lastScannedAt)}
        subLabel={t('provisioning.stats.last-scan-sub', 'Auto-scan enabled')}
        label={t('provisioning.stats.last-scan-label', 'Last scan')}
      />
    </div>
  );
}

function MigrateRowButton({ repos }: { repos: Repository[] }) {
  const target = migrateTarget(repos);
  return (
    <LinkButton variant="secondary" size="sm" icon="upload" href={target}>
      <Trans i18nKey="provisioning.stats.migrate-button">Migrate</Trans>
    </LinkButton>
  );
}

function ResourceTypesTable({
  rows,
  repos,
}: {
  rows: GroupBreakdown[];
  repos: Repository[];
}) {
  const styles = useStyles2(getStyles);

  const columns: Array<Column<GroupBreakdown>> = useMemo(
    () => [
      {
        id: 'label',
        header: t('provisioning.stats.column-resource', 'Resource'),
        sortType: 'string',
        cell: ({ row }) => (
          <Stack direction="row" gap={1} alignItems="center">
            <span className={styles.resourceIcon} aria-hidden>
              <Icon name={resourceIcon(row.original.group)} />
            </span>
            <Text>{row.original.label}</Text>
          </Stack>
        ),
      },
      {
        id: 'total',
        header: t('provisioning.stats.column-total', 'Total'),
        sortType: 'number',
        cell: ({ row }) => <Text>{row.original.total.toLocaleString()}</Text>,
      },
      {
        id: 'unmanagedCount',
        header: t('provisioning.stats.column-unmanaged', 'Unmanaged'),
        sortType: 'number',
        cell: ({ row }) => (
          <Text color={row.original.unmanagedCount > 0 ? 'warning' : 'secondary'}>
            {row.original.unmanagedCount.toLocaleString()}
          </Text>
        ),
      },
      {
        id: 'managed',
        header: t('provisioning.stats.column-managed', 'Managed'),
        sortType: (a, b) => {
          const av = a.original.gitSyncCount + a.original.otherManagedCount;
          const bv = b.original.gitSyncCount + b.original.otherManagedCount;
          return av - bv;
        },
        cell: ({ row }) => {
          const value = row.original.gitSyncCount + row.original.otherManagedCount;
          return <Text color={value > 0 ? 'info' : 'secondary'}>{value.toLocaleString()}</Text>;
        },
      },
      {
        id: 'managedPct',
        header: t('provisioning.stats.column-managed-pct', '% managed'),
        sortType: (a, b) => {
          const av = a.original.total === 0 ? 0 : (a.original.gitSyncCount + a.original.otherManagedCount) / a.original.total;
          const bv = b.original.total === 0 ? 0 : (b.original.gitSyncCount + b.original.otherManagedCount) / b.original.total;
          return av - bv;
        },
        cell: ({ row }) => {
          const value = row.original.gitSyncCount + row.original.otherManagedCount;
          const pctText = percent(value, row.original.total);
          const color = value === row.original.total && row.original.total > 0 ? 'success' : value === 0 ? 'warning' : 'info';
          return (
            <div className={styles.managedPctCell}>
              <div className={styles.managedPctBar}>
                <CoverageBar covered={value} total={row.original.total} compact />
              </div>
              <Text color={color}>{pctText}</Text>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row }) =>
          row.original.unmanagedCount === 0 ? null : <MigrateRowButton repos={repos} />,
      },
    ],
    [repos, styles.managedPctCell, styles.managedPctBar, styles.resourceIcon]
  );

  return (
    <div className={styles.tablePanel}>
      <Stack direction="column" gap={0.5}>
        <Text variant="h5">
          <Trans i18nKey="provisioning.stats.resource-types-heading">Resource types</Trans>
        </Text>
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="provisioning.stats.resource-types-subtitle">
            Folders and dashboards on this instance, grouped by type. Bring any unmanaged ones under Git Sync to
            track and review their changes.
          </Trans>
        </Text>
      </Stack>
      <InteractiveTable columns={columns} data={rows} getRowId={rowKey} pageSize={0} />
      <Text color="secondary" variant="bodySmall">
        {t('provisioning.stats.resource-types-footer', 'Showing {{count}} of {{total}} resource types', {
          count: rows.length,
          total: rows.length,
        })}
      </Text>
    </div>
  );
}

interface NextStep {
  key: string;
  done: boolean;
  title: string;
  description: string;
  action?: { label: string; href: string };
  primary?: boolean;
}

function NextStepsPanel({
  totals,
  repos,
}: {
  totals: ReturnType<typeof aggregateTotals>;
  repos: Repository[];
}) {
  const styles = useStyles2(getStyles);
  const hasRepo = repos.length > 0;
  const repoTarget = migrateTarget(repos);

  const steps: NextStep[] = [
    {
      key: 'connect',
      done: hasRepo,
      title: t('provisioning.stats.next-step-connect-title', 'Connect a Git repository'),
      description: hasRepo
        ? t('provisioning.stats.next-step-connect-done', 'Connected. You can add more at any time.')
        : t(
            'provisioning.stats.next-step-connect-pending',
            'Set up Git Sync so your folders and dashboards live in a Git repository.'
          ),
      action: hasRepo
        ? undefined
        : { label: t('provisioning.stats.next-step-connect-cta', 'Connect'), href: GETTING_STARTED_URL },
      primary: !hasRepo,
    },
    {
      key: 'review',
      done: totals.instanceTotal > 0 && totals.unmanaged === 0,
      title: t('provisioning.stats.next-step-review-title', 'Review unmanaged resources'),
      description:
        totals.instanceTotal === 0
          ? t('provisioning.stats.next-step-review-empty', 'No folders or dashboards yet — nothing to review.')
          : t(
              'provisioning.stats.next-step-review-pending',
              '{{count}} of {{total}} folders and dashboards are still unmanaged.',
              { count: totals.unmanaged, total: totals.instanceTotal }
            ),
    },
    {
      key: 'migrate',
      done: totals.gitSync > 0,
      title: t('provisioning.stats.next-step-migrate-title', 'Migrate your first resource'),
      description:
        totals.gitSync > 0
          ? t(
              'provisioning.stats.next-step-migrate-done',
              '{{count}} folders and dashboards are managed by Git Sync.',
              { count: totals.gitSync }
            )
          : t(
              'provisioning.stats.next-step-migrate-pending',
              'Bring an existing folder or dashboard under Git Sync to start the journey.'
            ),
      action:
        hasRepo && totals.gitSync === 0 && totals.unmanaged > 0
          ? { label: t('provisioning.stats.next-step-migrate-cta', 'Open repository'), href: repoTarget }
          : undefined,
    },
  ];

  return (
    <div className={styles.sidePanel}>
      <Text variant="h5">
        <Trans i18nKey="provisioning.stats.next-steps-heading">Recommended next steps</Trans>
      </Text>
      <Stack direction="column" gap={1.5}>
        {steps.map((step, index) => (
          <Stack key={step.key} direction="row" gap={2} alignItems="flex-start">
            <div className={cx(styles.nextStepBullet, step.done && styles.nextStepBulletDone)}>
              {step.done ? <Icon name="check" /> : <Text variant="bodySmall">{index + 1}</Text>}
            </div>
            <Stack direction="column" gap={0.25} flex={1}>
              <Text weight={step.done ? 'regular' : 'medium'}>{step.title}</Text>
              <Text color="secondary" variant="bodySmall">
                {step.description}
              </Text>
            </Stack>
            {step.action && (
              <LinkButton variant={step.primary ? 'primary' : 'secondary'} size="sm" href={step.action.href}>
                {step.action.label}
              </LinkButton>
            )}
          </Stack>
        ))}
      </Stack>
      <TextLink external href={CONFIGURE_GRAFANA_DOCS_URL} variant="bodySmall">
        <Trans i18nKey="provisioning.stats.migration-guide">Migration guide</Trans>
      </TextLink>
    </div>
  );
}

function ToolTile({ tool, count }: { tool: SupportedTool; count: number }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.toolTile}>
      <div className={styles.toolTileBadge}>
        {tool.image ? (
          <img src={tool.image} alt="" className={styles.toolTileImage} />
        ) : tool.icon ? (
          <Icon name={tool.icon} size="xl" />
        ) : (
          <span className={styles.toolTileInitial}>{tool.initial}</span>
        )}
      </div>
      <Stack direction="row" gap={0.5} alignItems="center" wrap>
        <Text variant="bodySmall" weight="medium">
          {tool.label}
        </Text>
        {tool.recommended && (
          <Text variant="bodySmall" color="success">
            <Trans i18nKey="provisioning.stats.tool-tile-recommended">Recommended</Trans>
          </Text>
        )}
      </Stack>
      <Text variant="bodySmall" color="secondary">
        {tool.description}
      </Text>
      {count > 0 && (
        <Text variant="bodySmall" color="primary">
          {t('provisioning.stats.tool-tile-managed-count', '{{count}} managed', { count })}
        </Text>
      )}
    </div>
  );
}

function ToolingSupportPanel({ breakdowns }: { breakdowns: GroupBreakdown[] }) {
  const styles = useStyles2(getStyles);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    breakdowns.forEach((b) => {
      result.set(ManagerKind.Repo, (result.get(ManagerKind.Repo) ?? 0) + b.gitSyncCount);
      Object.entries(b.managedByKind).forEach(([kind, c]) => {
        result.set(kind, (result.get(kind) ?? 0) + c);
      });
    });
    return result;
  }, [breakdowns]);

  return (
    <div className={styles.sidePanel}>
      <Text variant="h5">
        <Trans i18nKey="provisioning.stats.tooling-support-heading">Tooling support</Trans>
      </Text>
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="provisioning.stats.tooling-support-description">
          Grafana supports multiple GitOps and provisioning tools. Choose the best fit for your workflow.
        </Trans>
      </Text>
      <div className={styles.toolingGrid}>
        {SUPPORTED_TOOLS.map((tool) => (
          <ToolTile key={tool.key} tool={tool} count={counts.get(tool.kind) ?? 0} />
        ))}
      </div>
      <TextLink external href={CONFIGURE_GRAFANA_DOCS_URL} variant="bodySmall">
        <Trans i18nKey="provisioning.stats.tooling-support-compare">Compare tools</Trans>
      </TextLink>
    </div>
  );
}

export function Migrate() {
  const query = useGetResourceStatsQuery();
  const { data, isLoading, isError, error } = query;
  const lastScannedAt =
    'fulfilledTimeStamp' in query && typeof query.fulfilledTimeStamp === 'number' ? query.fulfilledTimeStamp : undefined;
  const [repos] = useRepositoryList({ watch: false });
  const repoList = repos ?? [];

  const breakdowns = useMemo(() => computeBreakdowns(data), [data]);
  const totals = useMemo(() => aggregateTotals(breakdowns), [breakdowns]);
  const tableRows = useMemo(() => breakdowns.filter((b) => b.total > 0), [breakdowns]);
  const styles = useStyles2(getStyles);

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

  if (totals.instanceTotal === 0) {
    return (
      <Stack direction="column" gap={3}>
        <MigrateToGitopsHeader />
        <EmptyState variant="not-found" message={t('provisioning.stats.empty', 'No provisioned resources yet')} />
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      <OverviewStatCards totals={totals} lastScannedAt={lastScannedAt} />
      <div className={styles.mainGrid}>
        <div className={styles.tableColumn}>
          <ResourceTypesTable rows={tableRows} repos={repoList} />
          <div className={styles.chartsRow}>
            <ManagedByToolPanel breakdowns={breakdowns} />
            <ResourceBreakdownPanel breakdowns={breakdowns} variant="managed" />
            <ResourceBreakdownPanel breakdowns={breakdowns} variant="unmanaged" />
          </div>
        </div>
        <div className={styles.sideColumn}>
          <NextStepsPanel totals={totals} repos={repoList} />
          <ToolingSupportPanel breakdowns={breakdowns} />
        </div>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  statCardsRow: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: theme.spacing(2),
  }),
  statCard: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    background: theme.colors.background.secondary,
    alignItems: 'center',
    boxShadow: theme.shadows.z1,
  }),
  statCardSurface_neutral: css({}),
  statCardSurface_success: css({
    background: theme.colors.success.transparent,
    borderColor: theme.colors.success.borderTransparent,
  }),
  statCardSurface_info: css({
    background: theme.colors.info.transparent,
    borderColor: theme.colors.info.borderTransparent,
  }),
  statCardSurface_warning: css({
    background: theme.colors.warning.transparent,
    borderColor: theme.colors.warning.borderTransparent,
  }),
  statCardSurface_primary: css({
    background: `color-mix(in srgb, ${theme.visualization.getColorByName('purple')} 12%, ${theme.colors.background.secondary})`,
    borderColor: `color-mix(in srgb, ${theme.visualization.getColorByName('purple')} 35%, transparent)`,
  }),
  statCardEmphasized: css({
    borderColor: theme.colors.warning.border,
    boxShadow: `0 0 0 1px ${theme.colors.warning.borderTransparent}, ${theme.shadows.z1}`,
  }),
  statCardBody: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    minWidth: 0,
  }),
  statCardIcon: css({
    flex: '0 0 auto',
    width: theme.spacing(5),
    height: theme.spacing(5),
    borderRadius: theme.shape.radius.circle,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  statIconTone_neutral: css({
    background: theme.colors.background.canvas,
    color: theme.colors.text.secondary,
  }),
  statIconTone_success: css({
    background: theme.colors.success.transparent,
    color: theme.colors.success.text,
  }),
  statIconTone_info: css({
    background: theme.colors.info.transparent,
    color: theme.colors.info.text,
  }),
  statIconTone_warning: css({
    background: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
  }),
  statIconTone_primary: css({
    background: `color-mix(in srgb, ${theme.visualization.getColorByName('purple')} 20%, transparent)`,
    color: theme.visualization.getColorByName('purple'),
  }),
  statCardLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  statCardTone_neutral: css({
    color: theme.colors.text.primary,
  }),
  statCardTone_success: css({
    color: theme.colors.success.text,
  }),
  statCardTone_info: css({
    color: theme.colors.info.text,
  }),
  statCardTone_warning: css({
    color: theme.colors.warning.text,
  }),
  statCardTone_primary: css({
    color: theme.visualization.getColorByName('purple'),
  }),
  coverageTrack: css({
    position: 'relative',
    width: '100%',
    height: theme.spacing(1.25),
    minHeight: 8,
    borderRadius: theme.shape.radius.pill,
    overflow: 'hidden',
    background: `color-mix(in srgb, ${theme.colors.warning.main} 25%, transparent)`,
    boxShadow: `inset 0 0 0 1px ${theme.colors.warning.borderTransparent}`,
  }),
  coverageTrackCompact: css({
    height: theme.spacing(0.75),
    minHeight: 6,
  }),
  coverageRow: css({
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  coverageBarFlex: css({
    flex: '1 1 auto',
    minWidth: 120,
  }),
  coverageFill: css({
    height: '100%',
    borderRadius: theme.shape.radius.pill,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'width 200ms ease, background 200ms ease',
    },
  }),
  mainGrid: css({
    display: 'grid',
    gridTemplateColumns: '2fr minmax(280px, 1fr)',
    gap: theme.spacing(3),
    alignItems: 'flex-start',
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: '1fr',
    },
  }),
  tableColumn: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    minWidth: 0,
  }),
  chartsRow: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: theme.spacing(2),
  }),
  chartPanel: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  legendDot: css({
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: theme.shape.radius.circle,
  }),
  sideColumn: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    minWidth: 0,
  }),
  tablePanel: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  sidePanel: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  nextStepBullet: css({
    flex: '0 0 auto',
    width: theme.spacing(3),
    height: theme.spacing(3),
    borderRadius: theme.shape.radius.circle,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  nextStepBulletDone: css({
    background: theme.colors.success.transparent,
    borderColor: theme.colors.success.border,
    color: theme.colors.success.text,
  }),
  managedPctCell: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  }),
  managedPctBar: css({
    flex: '1 1 auto',
    minWidth: 60,
    maxWidth: 120,
  }),
  toolingGrid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
    gap: theme.spacing(1),
  }),
  toolTile: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    textAlign: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.5, 1),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
  }),
  toolTileBadge: css({
    width: theme.spacing(5),
    height: theme.spacing(5),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.primary,
  }),
  toolTileImage: css({
    width: theme.spacing(3.5),
    height: theme.spacing(3.5),
    objectFit: 'contain',
  }),
  toolTileInitial: css({
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: 1,
  }),
  resourceIcon: css({
    width: theme.spacing(3),
    height: theme.spacing(3),
    color: theme.colors.text.secondary,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
  }),
  emptyDonutWrap: css({
    position: 'relative',
    width: 140,
    height: 140,
    flex: '0 0 auto',
  }),
  emptyDonutIcon: css({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    transform: 'rotate(-12deg)',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${rocketBob} 3s ease-in-out infinite`,
    },
  }),
});

const rocketBob = keyframes({
  '0%, 100%': { transform: 'translateY(0) rotate(-12deg)' },
  '50%': { transform: 'translateY(-4px) rotate(-12deg)' },
});
