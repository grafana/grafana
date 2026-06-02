import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { FeatureState, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, FeatureBadge, Icon, type IconName, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { type ManagerStats, type ResourceStats, useGetResourceStatsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { ManagerKind } from 'app/features/apiserver/types';

const FOLDER_GROUPS = ['folder.grafana.app', 'folders'];
const DASHBOARD_GROUPS = ['dashboard.grafana.app'];

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
    return t('provisioning.migrate.folders', 'Folders');
  }
  if (DASHBOARD_GROUPS.includes(group)) {
    return t('provisioning.migrate.dashboards', 'Dashboards');
  }
  return group;
}

/**
 * Build per-type breakdowns for Folders and Dashboards from the API
 * response. Always emits one row per type even when the API doesn't
 * report any, so the cards read consistently.
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
  // The Migrate to GitOps page is dashboard-centric: the KPI row reports
  // dashboard counts (folders are tracked separately by the gauge card). Skip
  // non-dashboard groups so totals don't double-count.
  const dashboardBreakdowns = breakdowns.filter((b) => DASHBOARD_GROUPS.includes(b.group));
  let instanceTotal = 0;
  let managed = 0;
  let unmanaged = 0;
  let gitSync = 0;
  dashboardBreakdowns.forEach((b) => {
    instanceTotal += b.total;
    gitSync += b.gitSyncCount;
    managed += b.gitSyncCount + b.otherManagedCount;
    unmanaged += b.unmanagedCount;
  });
  return { instanceTotal, managed, unmanaged, gitSync };
}

/** Managed and total folder counts, derived from the folder breakdown. */
function aggregateFolderCounts(breakdowns: GroupBreakdown[]) {
  const folderBreakdowns = breakdowns.filter((b) => FOLDER_GROUPS.includes(b.group));
  let total = 0;
  let managed = 0;
  folderBreakdowns.forEach((b) => {
    total += b.total;
    managed += b.gitSyncCount + b.otherManagedCount;
  });
  return { managed, total };
}

function percent(part: number, total: number): string {
  if (total === 0) {
    return '0%';
  }
  return `${Math.round((part / total) * 100)}%`;
}

function MigrateToGitopsHeader() {
  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row" gap={1} alignItems="center">
        <Text element="h2" variant="h2">
          <Trans i18nKey="provisioning.migrate.header-title">Migrate to GitOps</Trans>
        </Text>
        <FeatureBadge featureState={FeatureState.experimental} />
      </Stack>
      <Text color="secondary">
        <Trans i18nKey="provisioning.migrate.header-subtitle">
          Manage your dashboards and folders like code — every change tracked, every update reviewed, every environment
          reproducible. Connect a Git repository to get started.
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
        <Icon name={icon} size="xl" />
      </div>
      <div className={styles.statCardBody}>
        <span className={cx(styles.statCardLabel, styles[`statCardTone_${tone}` as const])}>{label}</span>
        <span className={styles.statCardValue}>{big}</span>
        {subLabel && (
          <Text color="secondary" variant="body">
            {subLabel}
          </Text>
        )}
      </div>
    </div>
  );
}

function SemicircleGauge({ pct }: { pct: number }) {
  const styles = useStyles2(getStyles);
  // Half-circle with radius 40 centered at (50, 50). Path goes from (10,50)
  // along the top arc to (90,50). Length = π * r = π * 40 ≈ 125.66.
  const radius = 40;
  const length = Math.PI * radius;
  const dashLen = Math.max(0, Math.min(1, pct)) * length;
  return (
    // The gauge is purely decorative — the surrounding card already exposes
    // the same percentage and "managed / total" fraction in text, so we drop
    // role="img" and mark the SVG as hidden so screen readers don't read the
    // percentage twice.
    <svg width="120" height="68" viewBox="0 0 100 60" className={styles.gauge} aria-hidden="true">
      <path
        d="M 10 50 A 40 40 0 0 1 90 50"
        fill="none"
        strokeWidth={10}
        strokeLinecap="round"
        className={styles.gaugeTrack}
      />
      <path
        d="M 10 50 A 40 40 0 0 1 90 50"
        fill="none"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${dashLen} ${length}`}
        className={styles.gaugeFill}
      />
    </svg>
  );
}

function FolderProgressCard({ managed, total }: { managed: number; total: number }) {
  const styles = useStyles2(getStyles);
  const pct = total === 0 ? 0 : managed / total;
  return (
    <div className={cx(styles.statCard, styles.gaugeCard)}>
      <span className={cx(styles.statCardLabel, styles.statCardTone_success)}>
        <Trans i18nKey="provisioning.migrate.folder-progress-label">Folders managed</Trans>
      </span>
      <SemicircleGauge pct={pct} />
      <span className={styles.statCardValue}>
        {t('provisioning.migrate.folder-progress-fraction', '{{managed}} / {{total}}', { managed, total })}
      </span>
      <Text color="secondary" variant="body">
        {t('provisioning.migrate.folder-progress-pct', '{{pct}}% complete', {
          pct: Math.round(pct * 100),
        })}
      </Text>
    </div>
  );
}

function OverviewStatCards({
  totals,
  folderCounts,
}: {
  totals: ReturnType<typeof aggregateTotals>;
  folderCounts: ReturnType<typeof aggregateFolderCounts>;
}) {
  const styles = useStyles2(getStyles);
  const progressSubLabel =
    totals.gitSync > 0
      ? t('provisioning.migrate.progress-gitops-sub', '{{count}} via Git Sync', { count: totals.gitSync })
      : t('provisioning.migrate.progress-gitops-sub-empty', 'Start your migration');
  const dashboardsOf = (value: number) =>
    t('provisioning.migrate.n-of-m-dashboards', '{{value}} of {{total}} dashboards', {
      value,
      total: totals.instanceTotal,
    });
  return (
    <div className={styles.statCardsRow}>
      <StatCard
        icon="apps"
        tone="info"
        big={totals.instanceTotal.toLocaleString()}
        subLabel={t('provisioning.migrate.summary-total-sub', 'Across all providers')}
        label={t('provisioning.migrate.summary-total', 'Dashboards')}
      />
      <StatCard
        icon="check-circle"
        tone="success"
        big={percent(totals.managed, totals.instanceTotal)}
        subLabel={dashboardsOf(totals.managed)}
        label={t('provisioning.migrate.managed', 'Managed dashboards')}
      />
      <StatCard
        icon="exclamation-triangle"
        tone="warning"
        emphasized={totals.unmanaged > 0}
        big={percent(totals.unmanaged, totals.instanceTotal)}
        subLabel={dashboardsOf(totals.unmanaged)}
        label={t('provisioning.migrate.summary-unmanaged', 'Unmanaged dashboards')}
      />
      <StatCard
        icon="chart-line"
        tone="primary"
        big={percent(totals.gitSync, totals.instanceTotal)}
        subLabel={progressSubLabel}
        label={t('provisioning.migrate.progress-gitops', 'Progress to GitOps')}
      />
      <FolderProgressCard managed={folderCounts.managed} total={folderCounts.total} />
    </div>
  );
}

/**
 * Migrate to GitOps tab. Shows an overview of how much of the instance is
 * already managed and how much progress has been made toward GitOps. The
 * interactive migration workflow (folder leaderboard, quick wins, the migrate
 * drawer) lands in follow-up changes.
 */
export function Migrate() {
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();

  const breakdowns = useMemo(() => computeBreakdowns(data), [data]);
  const totals = useMemo(() => aggregateTotals(breakdowns), [breakdowns]);
  const folderCounts = useMemo(() => aggregateFolderCounts(breakdowns), [breakdowns]);

  if (isLoading) {
    return (
      <Stack direction="row" alignItems="center" gap={1}>
        <Spinner />
        <Trans i18nKey="provisioning.migrate.loading">Loading stats...</Trans>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" title={t('provisioning.migrate.error-title', 'Failed to load provisioning stats')}>
        {getErrorMessage(error)}
      </Alert>
    );
  }

  if (totals.instanceTotal === 0) {
    return (
      <Stack direction="column" gap={3}>
        <MigrateToGitopsHeader />
        <EmptyState variant="not-found" message={t('provisioning.migrate.empty', 'No provisioned resources yet')} />
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={3}>
      <MigrateToGitopsHeader />
      <OverviewStatCards totals={totals} folderCounts={folderCounts} />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  statCardsRow: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
  gaugeCard: css({
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: theme.spacing(0.25),
  }),
  gauge: css({
    alignSelf: 'center',
  }),
  gaugeTrack: css({
    stroke: theme.colors.background.canvas,
  }),
  gaugeFill: css({
    stroke: theme.colors.success.main,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: 'stroke-dasharray 240ms ease',
    },
  }),
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
    width: theme.spacing(6),
    height: theme.spacing(6),
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
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  statCardValue: css({
    fontSize: '44px',
    lineHeight: 1.1,
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.primary,
    letterSpacing: '-0.5px',
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
});
