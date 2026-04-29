import { css, cx } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Alert,
  Badge,
  type BadgeColor,
  Card,
  type Column,
  EmptyState,
  FilterInput,
  Icon,
  InteractiveTable,
  LinkButton,
  Select,
  Spinner,
  Stack,
  Text,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import {
  type ManagerStats,
  type Repository,
  type ResourceCount,
  type ResourceStats,
  useGetResourceStatsQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

import { GETTING_STARTED_URL, PROVISIONING_URL } from '../constants';
import { useRepositoryList } from '../hooks/useRepositoryList';

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
    // YAML/JSON config under `provisioning/`: dashboards (which create
    // folders implicitly via the dashboard provider's `folder` setting),
    // datasources, alerting, and access control. Documented in
    // docs/sources/administration/provisioning/.
    groups: [
      ...FOLDER_GROUPS,
      ...DASHBOARD_GROUPS,
      'datasource.grafana.app',
      'alerting.grafana.app',
      'access-control.grafana.app',
    ],
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
      return t('provisioning.stats.manager-kind-classic-fp', 'Files (Classic)');
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

/** Map a manager kind to a Badge color for the supported-by chips. */
function badgeColorForKind(kind: string): BadgeColor {
  switch (kind) {
    case ManagerKind.Repo:
      return 'green';
    case ManagerKind.Terraform:
      return 'blue';
    case ManagerKind.Kubectl:
      return 'purple';
    case ManagerKind.Plugin:
      return 'orange';
    case CLASSIC_FILE_PROVISIONING:
      return 'red';
    default:
      return 'darkgrey';
  }
}

function GitOpsExplainer() {
  return (
    <Alert severity="info" title={t('provisioning.stats.gitops-title', 'What is GitOps?')}>
      <Trans i18nKey="provisioning.stats.gitops-body">
        Manage your folders, dashboards, and other resources as code. Tools like Git Sync, Terraform, and kubectl let
        you store these definitions in a Git repository (or another source of truth) so every change is versioned,
        reviewable, and reproducible. The live state of the instance comes from your repository, not the other way
        around. The breakdown below shows how much of your instance is managed this way today, and which tools are
        involved.
      </Trans>
    </Alert>
  );
}

/**
 * Aggregate the filtered breakdowns into the numbers we surface in the
 * Summary panel. The provider dropdown acts as a lens:
 * - "all": Total / Managed (any provider) / Unmanaged.
 * - specific kind X: Total / X / Other tools (managed by ≠ X) / Unmanaged.
 */
function aggregateLensTotals(breakdowns: GroupBreakdown[], providerFilter: string) {
  let instanceTotal = 0;
  let unmanaged = 0;
  let totalManaged = 0;
  let selected = 0;
  breakdowns.forEach((b) => {
    instanceTotal += b.total;
    unmanaged += b.unmanagedCount;
    const rowManaged = b.gitSyncCount + b.otherManagedCount;
    totalManaged += rowManaged;
    if (providerFilter === ManagerKind.Repo) {
      selected += b.gitSyncCount;
    } else if (providerFilter !== 'all') {
      selected += b.managedByKind[providerFilter] ?? 0;
    }
  });
  return {
    instanceTotal,
    unmanaged,
    managed: totalManaged,
    selected,
    other: totalManaged - selected,
  };
}

interface BarSegment {
  key: string;
  value: number;
  color: string;
  label: string;
}

function StackedProgressBar({ segments }: { segments: BarSegment[] }) {
  const styles = useStyles2(getStyles);
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  return (
    <div
      className={styles.progressBar}
      role="img"
      aria-label={t('provisioning.stats.progress-aria', 'Provisioning breakdown')}
    >
      {total === 0
        ? null
        : segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const pct = Math.round((s.value / total) * 100);
              return (
                <div
                  key={s.key}
                  className={styles.progressSegment}
                  style={{ flex: s.value, background: s.color }}
                  title={t('provisioning.stats.progress-segment-tooltip', '{{label}}: {{value}} ({{pct}}%)', {
                    label: s.label,
                    value: s.value,
                    pct,
                  })}
                />
              );
            })}
    </div>
  );
}

function SummarySection({ breakdowns, providerFilter }: { breakdowns: GroupBreakdown[]; providerFilter: string }) {
  const theme = useTheme2();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const totals = useMemo(() => aggregateLensTotals(breakdowns, providerFilter), [breakdowns, providerFilter]);
  const isAll = providerFilter === 'all';

  const barSegments: BarSegment[] = isAll
    ? [
        {
          key: 'managed',
          value: totals.managed,
          color: theme.colors.success.main,
          label: t('provisioning.stats.summary-managed', 'Managed'),
        },
        {
          key: 'unmanaged',
          value: totals.unmanaged,
          color: theme.colors.warning.main,
          label: t('provisioning.stats.legend-unmanaged', 'Unmanaged'),
        },
      ]
    : [
        {
          key: providerFilter,
          value: totals.selected,
          color: theme.colors.success.main,
          label: kindLabel(providerFilter),
        },
        {
          key: 'other',
          value: totals.other,
          color: theme.colors.info.main,
          label: t('provisioning.stats.legend-other', 'Managed by other tools'),
        },
        {
          key: 'unmanaged',
          value: totals.unmanaged,
          color: theme.colors.warning.main,
          label: t('provisioning.stats.legend-unmanaged', 'Unmanaged'),
        },
      ];

  return (
    <Stack direction="column" gap={2}>
      <StackedProgressBar segments={barSegments} />
      <Stack direction="row" gap={1.5} wrap justifyContent="center">
        <ProviderStat
          segmentKey="total"
          big={totals.instanceTotal.toLocaleString()}
          label={t('provisioning.stats.summary-total', 'Total resources')}
          hoveredKey={hoveredKey}
          onHover={setHoveredKey}
        />
        {isAll ? (
          <ProviderStat
            segmentKey="managed"
            big={percent(totals.managed, totals.instanceTotal)}
            subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
              value: totals.managed,
              total: totals.instanceTotal,
            })}
            label={t('provisioning.stats.summary-managed', 'Managed')}
            colorHex={theme.colors.success.main}
            hoveredKey={hoveredKey}
            onHover={setHoveredKey}
          />
        ) : (
          <>
            <ProviderStat
              segmentKey={providerFilter}
              big={percent(totals.selected, totals.instanceTotal)}
              subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
                value: totals.selected,
                total: totals.instanceTotal,
              })}
              label={kindLabel(providerFilter)}
              colorHex={theme.colors.success.main}
              hoveredKey={hoveredKey}
              onHover={setHoveredKey}
            />
            <ProviderStat
              segmentKey="other"
              big={percent(totals.other, totals.instanceTotal)}
              subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
                value: totals.other,
                total: totals.instanceTotal,
              })}
              label={t('provisioning.stats.legend-other', 'Managed by other tools')}
              colorHex={theme.colors.info.main}
              hoveredKey={hoveredKey}
              onHover={setHoveredKey}
            />
          </>
        )}
        <ProviderStat
          segmentKey="unmanaged"
          big={percent(totals.unmanaged, totals.instanceTotal)}
          subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
            value: totals.unmanaged,
            total: totals.instanceTotal,
          })}
          label={t('provisioning.stats.legend-unmanaged', 'Unmanaged')}
          colorHex={theme.colors.warning.main}
          hoveredKey={hoveredKey}
          onHover={setHoveredKey}
        />
      </Stack>
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

/**
 * Per-row action that points the user at the right place to migrate
 * unmanaged folders or dashboards. With at least one Git Sync repository
 * we drop them on that repo (or the Repositories tab when there are
 * several); without a repository we send them to the Get started tab so
 * they can connect one.
 */
function MigrateRowButton({ repos }: { repos: Repository[] }) {
  const target = (() => {
    if (repos.length === 0) {
      return GETTING_STARTED_URL;
    }
    if (repos.length === 1 && repos[0].metadata?.name) {
      return `${PROVISIONING_URL}/${repos[0].metadata.name}`;
    }
    return PROVISIONING_URL;
  })();
  return (
    <LinkButton variant="secondary" size="sm" icon="upload" href={target}>
      <Trans i18nKey="provisioning.stats.migrate-button">Migrate</Trans>
    </LinkButton>
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

type ManagementState = 'fully' | 'partial' | 'none';

function managedShare(row: GroupBreakdown): number {
  if (row.total === 0) {
    return 0;
  }
  return (row.gitSyncCount + row.otherManagedCount) / row.total;
}

function getManagementState(row: GroupBreakdown): ManagementState {
  if (row.unmanagedCount === 0) {
    return 'fully';
  }
  if (row.gitSyncCount + row.otherManagedCount === 0) {
    return 'none';
  }
  return 'partial';
}

function ManagementStatusIcon({ state }: { state: ManagementState }) {
  const theme = useTheme2();
  if (state === 'fully') {
    return (
      <span aria-label={t('provisioning.stats.status-fully', 'Fully managed')} role="img">
        <Icon name="check-circle" style={{ color: theme.colors.success.main }} />
      </span>
    );
  }
  if (state === 'none') {
    return (
      <svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        aria-label={t('provisioning.stats.status-none', 'Not managed')}
        role="img"
      >
        <circle cx="8" cy="8" r="6" fill="none" stroke={theme.colors.error.main} strokeWidth={1.5} />
      </svg>
    );
  }
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      aria-label={t('provisioning.stats.status-partial', 'Partially managed')}
      role="img"
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke={theme.colors.warning.main} strokeWidth={1.5} />
      <path d="M 8 2 A 6 6 0 0 1 8 14 Z" fill={theme.colors.warning.main} />
    </svg>
  );
}

interface FiltersValue {
  providerFilter: string;
  searchQuery: string;
}

function FiltersBar({ value, onChange }: { value: FiltersValue; onChange: (next: FiltersValue) => void }) {
  const styles = useStyles2(getStyles);
  const filterOptions: Array<SelectableValue<string>> = useMemo(
    () => [
      { value: 'all', label: t('provisioning.stats.filter-all', 'All providers') },
      ...Object.keys(PROVIDER_SUPPORT).map((kind) => ({ value: kind, label: kindLabel(kind) })),
    ],
    []
  );
  return (
    <Stack direction="row" gap={1.5} alignItems="center" wrap>
      <div className={styles.searchInput}>
        <FilterInput
          placeholder={t('provisioning.stats.search-placeholder', 'Search resource types')}
          value={value.searchQuery}
          onChange={(searchQuery) => onChange({ ...value, searchQuery })}
        />
      </div>
      <Stack direction="row" gap={1} alignItems="center">
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="provisioning.stats.filter-label">Show types supported by</Trans>
        </Text>
        <div className={styles.providerSelect}>
          <Select
            value={value.providerFilter}
            options={filterOptions}
            onChange={(v) => onChange({ ...value, providerFilter: v.value ?? 'all' })}
            aria-label={t('provisioning.stats.filter-aria-label', 'Filter resource types by provider')}
          />
        </div>
      </Stack>
    </Stack>
  );
}

function applyFilters(breakdowns: GroupBreakdown[], filters: FiltersValue): GroupBreakdown[] {
  let result = breakdowns.filter((b) => b.total > 0);
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    result = result.filter(
      (b) =>
        b.label.toLowerCase().includes(q) || b.resource.toLowerCase().includes(q) || b.group.toLowerCase().includes(q)
    );
  }
  return result;
}

/** Resolve the per-row "managed by the selected lens" count. */
function selectedManagedFor(row: GroupBreakdown, providerFilter: string): number {
  if (providerFilter === 'all') {
    return row.gitSyncCount + row.otherManagedCount;
  }
  if (providerFilter === ManagerKind.Repo) {
    return row.gitSyncCount;
  }
  return row.managedByKind[providerFilter] ?? 0;
}

function ResourceTypesSection({
  rows,
  hasUnfilteredRows,
  providerFilter,
}: {
  rows: GroupBreakdown[];
  hasUnfilteredRows: boolean;
  providerFilter: string;
}) {
  const [repos] = useRepositoryList({ watch: false });
  const gitSyncRepos = useMemo(() => repos ?? [], [repos]);
  const managedHeader =
    providerFilter === 'all'
      ? t('provisioning.stats.column-managed', 'Managed')
      : t('provisioning.stats.column-managed-by', 'Managed by {{provider}}', {
          provider: kindLabel(providerFilter),
        });

  const columns: Array<Column<GroupBreakdown>> = useMemo(
    () => [
      {
        id: 'status',
        header: '',
        cell: ({ row }) => <ManagementStatusIcon state={getManagementState(row.original)} />,
        disableGrow: true,
      },
      {
        id: 'label',
        header: t('provisioning.stats.column-resource', 'Resource'),
        sortType: 'string',
        cell: ({ row }) => <Text>{row.original.label}</Text>,
      },
      {
        id: 'total',
        header: t('provisioning.stats.column-total', 'Total'),
        sortType: 'number',
        cell: ({ row }) => <Text>{row.original.total.toLocaleString()}</Text>,
      },
      {
        id: 'managed',
        header: managedHeader,
        sortType: (a, b) =>
          selectedManagedFor(a.original, providerFilter) - selectedManagedFor(b.original, providerFilter),
        cell: ({ row }) => {
          const value = selectedManagedFor(row.original, providerFilter);
          return <Text color={value > 0 ? 'info' : 'secondary'}>{value.toLocaleString()}</Text>;
        },
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
        id: 'managedPct',
        header: t('provisioning.stats.column-managed-pct', '% managed'),
        sortType: (a, b) => managedShare(a.original) - managedShare(b.original),
        cell: ({ row }) => {
          const share = managedShare(row.original);
          const pctText = `${Math.round(share * 100)}%`;
          const color = share === 1 ? 'success' : share === 0 ? 'warning' : 'info';
          return <Text color={color}>{pctText}</Text>;
        },
      },
      {
        id: 'supportedBy',
        header: t('provisioning.stats.column-supported-by', 'Supported by'),
        cell: ({ row }) => (
          <Stack direction="row" gap={0.5} wrap>
            {providersThatSupport(row.original.group).map((kind) => (
              <Badge key={kind} color={badgeColorForKind(kind)} text={kindLabel(kind)} />
            ))}
          </Stack>
        ),
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row }) => {
          // Migrate from the UI is Git-Sync-only, so only render the action
          // on Git-Sync-supported rows that still have unmanaged resources.
          // Whether or not a repo is configured the button is shown — it
          // routes to the Get started tab when there isn't one yet.
          if (!row.original.isGitSyncSupported || row.original.unmanagedCount === 0) {
            return null;
          }
          return <MigrateRowButton repos={gitSyncRepos} />;
        },
      },
    ],
    [gitSyncRepos, managedHeader, providerFilter]
  );

  if (!hasUnfilteredRows) {
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
      {rows.length === 0 ? (
        <Alert
          severity="info"
          title={t('provisioning.stats.filter-empty-title', 'No resource types match the current filters')}
        />
      ) : (
        <InteractiveTable
          columns={columns}
          data={rows}
          getRowId={(row) => `${row.group}/${row.resource}`}
          pageSize={10}
        />
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

export function ProvisioningOverview() {
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();
  const [filters, setFilters] = useState<FiltersValue>({ providerFilter: 'all', searchQuery: '' });

  const computed = useMemo(() => computeStats(data), [data]);
  const filteredBreakdowns = useMemo(
    () => applyFilters(computed.groupBreakdowns, filters),
    [computed.groupBreakdowns, filters]
  );
  const hasUnfilteredRows = useMemo(
    () => computed.groupBreakdowns.some((b) => b.total > 0),
    [computed.groupBreakdowns]
  );

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
      <GitOpsExplainer />
      {hasUnfilteredRows && <FiltersBar value={filters} onChange={setFilters} />}
      <SummarySection breakdowns={filteredBreakdowns} providerFilter={filters.providerFilter} />
      {computed.gitSync && <GitSyncReposSection gitSync={computed.gitSync} />}
      <OtherProvidersSection providers={computed.otherProviders} />
      <ResourceTypesSection
        rows={filteredBreakdowns}
        hasUnfilteredRows={hasUnfilteredRows}
        providerFilter={filters.providerFilter}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  providerStat: css({
    flex: '0 1 160px',
    minWidth: 140,
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
  providerSelect: css({
    minWidth: 220,
  }),
  progressBar: css({
    display: 'flex',
    width: '100%',
    height: theme.spacing(1.25),
    borderRadius: theme.shape.radius.pill,
    overflow: 'hidden',
    background: theme.colors.background.secondary,
  }),
  progressSegment: css({
    height: '100%',
  }),
  searchInput: css({
    flex: '1 1 220px',
    maxWidth: 360,
  }),
});
