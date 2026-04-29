import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Alert,
  Badge,
  type BadgeColor,
  Button,
  Checkbox,
  type Column,
  EmptyState,
  Icon,
  InteractiveTable,
  LinkButton,
  Spinner,
  Stack,
  Text,
  TextLink,
  useStyles2,
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

const FOLDER_GROUPS = ['folder.grafana.app', 'folders'];
const DASHBOARD_GROUPS = ['dashboard.grafana.app'];

const CLASSIC_FILE_PROVISIONING = 'classic-file-provisioning';

/**
 * Providers that can manage folders or dashboards. The Overview page is
 * scoped to those two resource types, so this is the universe of tools we
 * surface in the supported-by chips, the Tooling support panel, etc.
 *
 * Sourced from the Grafana docs (`docs/sources/`) and the supported-resources
 * lists in `pkg/registry/apis/provisioning/resources/client.go`.
 */
const FOLDERS_DASHBOARDS_TOOLS = [
  ManagerKind.Repo,
  CLASSIC_FILE_PROVISIONING,
  ManagerKind.Terraform,
  ManagerKind.Kubectl,
  ManagerKind.Plugin,
] as const;

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
      return t('provisioning.stats.manager-kind-kubectl', 'kubectl');
    case ManagerKind.Plugin:
      return t('provisioning.stats.manager-kind-plugin', 'Plugin');
    case CLASSIC_FILE_PROVISIONING:
      return t('provisioning.stats.manager-kind-classic-fp', 'Files (Classic)');
    default:
      return kind || t('provisioning.stats.manager-kind-unknown', 'Unknown');
  }
}

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

function MigrateToGitopsHeader() {
  return (
    <Stack direction="row" gap={2} wrap alignItems="flex-start" justifyContent="space-between">
      <Stack direction="column" gap={1}>
        <Text element="h2" variant="h2">
          <Trans i18nKey="provisioning.stats.header-title">Migrate to GitOps</Trans>
        </Text>
        <Text color="secondary">
          <Trans i18nKey="provisioning.stats.header-subtitle">
            Version-control your dashboards and folders. Track changes, review updates, and keep your instance
            reproducible. Start by connecting a Git repository, then migrate the resources below.
          </Trans>
        </Text>
      </Stack>
      <LinkButton
        variant="secondary"
        icon="external-link-alt"
        href={CONFIGURE_GRAFANA_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Trans i18nKey="provisioning.stats.migration-guide">Migration guide</Trans>
      </LinkButton>
    </Stack>
  );
}

function StatCard({
  big,
  subLabel,
  label,
  color,
}: {
  big: string;
  subLabel?: string;
  label: string;
  color?: 'success' | 'info' | 'warning';
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.statCard}>
      <Text variant="h1" color={color}>
        {big}
      </Text>
      {subLabel && (
        <Text color="secondary" variant="bodySmall">
          {subLabel}
        </Text>
      )}
      <Text color="secondary" variant="bodySmall">
        {label}
      </Text>
    </div>
  );
}

function OverviewStatCards({
  totals,
}: {
  totals: ReturnType<typeof aggregateTotals>;
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.statCardsRow}>
      <StatCard
        big={totals.instanceTotal.toLocaleString()}
        label={t('provisioning.stats.summary-total', 'Total resources')}
      />
      <StatCard
        big={percent(totals.managed, totals.instanceTotal)}
        subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
          value: totals.managed,
          total: totals.instanceTotal,
        })}
        label={t('provisioning.stats.summary-managed', 'Managed')}
        color="success"
      />
      <StatCard
        big={percent(totals.unmanaged, totals.instanceTotal)}
        subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
          value: totals.unmanaged,
          total: totals.instanceTotal,
        })}
        label={t('provisioning.stats.summary-unmanaged', 'Unmanaged')}
        color="warning"
      />
      <StatCard
        big={percent(totals.gitSync, totals.instanceTotal)}
        subLabel={t('provisioning.stats.n-of-m', '{{value}} of {{total}}', {
          value: totals.gitSync,
          total: totals.instanceTotal,
        })}
        label={t('provisioning.stats.progress-to-gitops', 'Progress to GitOps')}
        color="info"
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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const eligibleRows = useMemo(() => rows.filter((r) => r.unmanagedCount > 0), [rows]);
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((r) => selected.has(rowKey(r)));
  const someEligibleSelected = !allEligibleSelected && eligibleRows.some((r) => selected.has(rowKey(r)));

  const toggleRow = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allEligibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligibleRows.map(rowKey)));
    }
  }, [allEligibleSelected, eligibleRows]);

  const columns: Array<Column<GroupBreakdown>> = useMemo(() => {
    const cols: Array<Column<GroupBreakdown>> = [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={allEligibleSelected}
            indeterminate={someEligibleSelected}
            onChange={toggleAll}
            aria-label={t('provisioning.stats.select-all-aria', 'Select all eligible rows')}
            disabled={eligibleRows.length === 0}
          />
        ),
        disableGrow: true,
        cell: ({ row }) => {
          const key = rowKey(row.original);
          return (
            <Checkbox
              checked={selected.has(key)}
              onChange={() => toggleRow(key)}
              aria-label={t('provisioning.stats.select-row-aria', 'Select {{label}}', {
                label: row.original.label,
              })}
              disabled={row.original.unmanagedCount === 0}
            />
          );
        },
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
        id: 'supportedBy',
        header: t('provisioning.stats.column-supported-by', 'Supported by'),
        cell: ({ row }) => (
          <Stack direction="row" gap={0.5} wrap>
            {FOLDERS_DASHBOARDS_TOOLS.map((kind) => (
              <Badge key={kind} color={badgeColorForKind(kind)} text={kindLabel(kind)} />
            ))}
          </Stack>
        ),
      },
      {
        id: 'actions',
        header: '',
        disableGrow: true,
        cell: ({ row }) =>
          row.original.unmanagedCount === 0 ? null : <MigrateRowButton repos={repos} />,
      },
    ];
    return cols;
  }, [
    repos,
    selected,
    allEligibleSelected,
    someEligibleSelected,
    eligibleRows,
    toggleAll,
    toggleRow,
    styles.managedPctCell,
    styles.managedPctBar,
  ]);

  return (
    <Stack direction="column" gap={1.5}>
      {selected.size > 0 && (
        <Stack direction="row" gap={1.5} alignItems="center">
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="provisioning.stats.bulk-selected" count={selected.size}>
              {{ count: selected.size }} resource type selected
            </Trans>
          </Text>
          <LinkButton variant="primary" size="sm" icon="upload" href={migrateTarget(repos)}>
            <Trans i18nKey="provisioning.stats.bulk-migrate">Migrate selected</Trans>
          </LinkButton>
          <Button variant="secondary" size="sm" fill="text" onClick={() => setSelected(new Set())}>
            <Trans i18nKey="provisioning.stats.bulk-clear">Clear</Trans>
          </Button>
        </Stack>
      )}
      <InteractiveTable columns={columns} data={rows} getRowId={rowKey} pageSize={0} />
    </Stack>
  );
}

interface NextStep {
  key: string;
  done: boolean;
  title: string;
  description: string;
  action?: { label: string; href: string };
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
              <LinkButton variant="secondary" size="sm" href={step.action.href}>
                {step.action.label}
              </LinkButton>
            )}
          </Stack>
        ))}
      </Stack>
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
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Text variant="h5">
          <Trans i18nKey="provisioning.stats.tooling-support-heading">Tooling support</Trans>
        </Text>
        <TextLink external href={CONFIGURE_GRAFANA_DOCS_URL} variant="bodySmall">
          <Trans i18nKey="provisioning.stats.tooling-support-compare">Compare tools</Trans>
        </TextLink>
      </Stack>
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="provisioning.stats.tooling-support-description">
          Folders and dashboards can be managed by any of these tools. Git Sync is the recommended starting point.
        </Trans>
      </Text>
      <Stack direction="column" gap={1}>
        {FOLDERS_DASHBOARDS_TOOLS.map((kind) => {
          const count = counts.get(kind) ?? 0;
          const isRepo = kind === ManagerKind.Repo;
          return (
            <Stack key={kind} direction="row" gap={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" gap={1} alignItems="center">
                <Badge color={badgeColorForKind(kind)} text={kindLabel(kind)} />
                {isRepo && (
                  <Badge
                    color="green"
                    text={t('provisioning.stats.tooling-recommended', 'Recommended')}
                  />
                )}
              </Stack>
              <Text variant="bodySmall" color={count > 0 ? 'primary' : 'secondary'}>
                {t('provisioning.stats.tooling-managed-count', '{{count}} managed', { count })}
              </Text>
            </Stack>
          );
        })}
      </Stack>
    </div>
  );
}

export function ProvisioningOverview() {
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();
  const [repos] = useRepositoryList({ watch: false });

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
      <OverviewStatCards totals={totals} />
      <CoverageBar covered={totals.managed} total={totals.instanceTotal} showRange />
      <div className={styles.mainGrid}>
        <div className={styles.tableColumn}>
          <ResourceTypesTable rows={tableRows} repos={repos ?? []} />
        </div>
        <div className={styles.sideColumn}>
          <NextStepsPanel totals={totals} repos={repos ?? []} />
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
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
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
    minWidth: 0,
  }),
  sideColumn: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    minWidth: 0,
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
});
