import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { FeatureState, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Alert,
  EmptyState,
  FeatureBadge,
  Icon,
  type IconName,
  LinkButton,
  Spinner,
  Stack,
  Text,
  TextLink,
  Tooltip,
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

import { CONFIGURE_GRAFANA_DOCS_URL, GETTING_STARTED_URL } from '../constants';
import { useRepositoryList } from '../hooks/useRepositoryList';
import gitSvg from '../img/git.svg';

import { FoldersToMigrate } from './FoldersToMigrate';
import { MigrateDrawer } from './MigrateDrawer';
import { QuickWinsPanel } from './QuickWinsPanel';
import { type FolderRow, useFolderLeaderboard } from './hooks/useFolderLeaderboard';

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
    description:
      'Two-way sync between Grafana and a Git repository. Edit folders and dashboards in either place, review every change through pull requests, and keep the full audit trail in your repo history.',
    image: gitSvg,
    recommended: true,
  },
  {
    key: 'terraform',
    kind: ManagerKind.Terraform,
    label: 'Terraform',
    description:
      'Manage folders and dashboards as Terraform resources alongside the rest of your infrastructure. Best when Terraform already runs your platform and you want a single source of state, plans, and approvals.',
    initial: 'T',
  },
  {
    key: 'gcx',
    kind: ManagerKind.Kubectl,
    label: 'GCX',
    description:
      'Push manifests from the command line with grafanactl, gcx, or kubectl. Lightweight for scripts, CI jobs, and one-off migrations without standing up a full GitOps pipeline.',
    icon: 'keyboard',
  },
  {
    key: 'file-system',
    kind: CLASSIC_FILE_PROVISIONING,
    label: 'File System',
    description:
      'Read folders and dashboards from local YAML or JSON files on the Grafana host. The classic provisioning path — simple to set up, but one-way and host-bound.',
    icon: 'file-alt',
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
  // The Migrate to GitOps page is dashboard-centric: the KPI row reports
  // dashboard counts (folders are tracked separately by the gauge card and
  // the folder list). Skip non-dashboard groups so totals don't double-count.
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

function SemicircleGauge({ pct }: { pct: number }) {
  const styles = useStyles2(getStyles);
  // Half-circle with radius 40 centered at (50, 50). Path goes from (10,50)
  // along the top arc to (90,50). Length = π * r = π * 40 ≈ 125.66.
  const radius = 40;
  const length = Math.PI * radius;
  const dashLen = Math.max(0, Math.min(1, pct)) * length;
  return (
    <svg width="120" height="68" viewBox="0 0 100 60" className={styles.gauge} role="img" aria-hidden>
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

function FolderProgressCard({ folders }: { folders: FolderRow[] }) {
  const styles = useStyles2(getStyles);
  const total = folders.length;
  const managed = folders.filter((f) => Boolean(f.managedBy)).length;
  const pct = total === 0 ? 0 : managed / total;
  return (
    <div className={cx(styles.statCard, styles.gaugeCard)}>
      <span className={cx(styles.statCardLabel, styles.statCardTone_success)}>
        <Trans i18nKey="provisioning.stats.folder-progress-label">Folders managed</Trans>
      </span>
      <SemicircleGauge pct={pct} />
      <Text variant="h2">
        {t('provisioning.stats.folder-progress-fraction', '{{managed}} / {{total}}', { managed, total })}
      </Text>
      <Text color="secondary" variant="bodySmall">
        {t('provisioning.stats.folder-progress-pct', '{{pct}}% complete', {
          pct: Math.round(pct * 100),
        })}
      </Text>
    </div>
  );
}

function OverviewStatCards({
  totals,
  folders,
}: {
  totals: ReturnType<typeof aggregateTotals>;
  folders: FolderRow[];
}) {
  const styles = useStyles2(getStyles);
  const progressSubLabel =
    totals.gitSync > 0
      ? t('provisioning.stats.progress-gitops-sub', '{{count}} via Git Sync', { count: totals.gitSync })
      : t('provisioning.stats.progress-gitops-sub-empty', 'Start your migration');
  const dashboardsOf = (value: number) =>
    t('provisioning.stats.n-of-m-dashboards', '{{value}} of {{total}} dashboards', {
      value,
      total: totals.instanceTotal,
    });
  return (
    <div className={styles.statCardsRow}>
      <StatCard
        icon="apps"
        tone="info"
        big={totals.instanceTotal.toLocaleString()}
        subLabel={t('provisioning.stats.summary-total-sub', 'Across all providers')}
        label={t('provisioning.stats.summary-total', 'Dashboards')}
      />
      <StatCard
        icon="check-circle"
        tone="success"
        big={percent(totals.managed, totals.instanceTotal)}
        subLabel={dashboardsOf(totals.managed)}
        label={t('provisioning.stats.managed', 'Managed')}
      />
      <StatCard
        icon="exclamation-triangle"
        tone="warning"
        emphasized={totals.unmanaged > 0}
        big={percent(totals.unmanaged, totals.instanceTotal)}
        subLabel={dashboardsOf(totals.unmanaged)}
        label={t('provisioning.stats.summary-unmanaged', 'Unmanaged')}
      />
      <StatCard
        icon="chart-line"
        tone="primary"
        big={percent(totals.gitSync, totals.instanceTotal)}
        subLabel={progressSubLabel}
        label={t('provisioning.stats.progress-gitops', 'Progress to GitOps')}
      />
      <FolderProgressCard folders={folders} />
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

  const hasStartedMigrating = totals.managed > 0;
  const hasDashboards = totals.instanceTotal > 0;
  const everythingManaged = hasDashboards && totals.unmanaged === 0;

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
      key: 'pick',
      done: hasStartedMigrating || everythingManaged,
      title: t('provisioning.stats.next-step-pick-title', 'Pick what to migrate'),
      description: everythingManaged
        ? t(
            'provisioning.stats.next-step-pick-empty',
            'Nothing left to migrate. New dashboards will appear here as your instance grows.'
          )
        : t(
            'provisioning.stats.next-step-pick-pending',
            'Use Quick wins for whole folders, or expand a folder below to migrate individual dashboards.'
          ),
    },
    {
      key: 'track',
      done: everythingManaged,
      title: t('provisioning.stats.next-step-track-title', 'Track migration progress'),
      description:
        !hasDashboards
          ? t('provisioning.stats.next-step-track-empty', 'No dashboards yet — nothing to track.')
          : t(
              'provisioning.stats.next-step-track-progress',
              '{{count}} of {{total}} dashboards managed.',
              { count: totals.managed, total: totals.instanceTotal }
            ),
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
      <Tooltip content={tool.description} placement="top">
        <Icon
          name="info-circle"
          size="xs"
          className={styles.toolTileInfo}
          tabIndex={0}
          aria-label={t('provisioning.stats.tool-tile-info-aria', 'About {{tool}}', { tool: tool.label })}
        />
      </Tooltip>
      <div className={styles.toolTileBadge}>
        {tool.image ? (
          <img src={tool.image} alt="" className={styles.toolTileImage} />
        ) : tool.icon ? (
          <Icon name={tool.icon} size="xl" />
        ) : (
          <span className={styles.toolTileInitial}>{tool.initial}</span>
        )}
      </div>
      <Text variant="bodySmall" weight="medium">
        {tool.label}
      </Text>
      {tool.recommended ? (
        <Text variant="bodySmall" color="success">
          <Trans i18nKey="provisioning.stats.tool-tile-recommended">Recommended</Trans>
        </Text>
      ) : count > 0 ? (
        <Text variant="bodySmall" color="primary">
          {t('provisioning.stats.tool-tile-managed-count', '{{count}} managed', { count })}
        </Text>
      ) : null}
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
        <Trans i18nKey="provisioning.stats.provisioning-tools-heading">Provisioning tools</Trans>
      </Text>
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="provisioning.stats.provisioning-tools-description">
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
  const { data, isLoading, isError, error } = useGetResourceStatsQuery();
  const [repos] = useRepositoryList({ watch: false });
  const repoList = repos ?? [];

  const breakdowns = useMemo(() => computeBreakdowns(data), [data]);
  const totals = useMemo(() => aggregateTotals(breakdowns), [breakdowns]);
  const styles = useStyles2(getStyles);

  const { data: folders } = useFolderLeaderboard();
  const [selectedFolderUids, setSelectedFolderUids] = useState<Set<string>>(new Set());
  const [selectedDashboardUids, setSelectedDashboardUids] = useState<Set<string>>(new Set());
  const [migrateDrawerOpen, setMigrateDrawerOpen] = useState(false);

  const toggleFolder = useCallback(
    (uid: string) => {
      const folder = folders.find((f) => f.uid === uid);
      const cascadeUids = folder?.allDashboards.map((d) => d.uid) ?? [];
      setSelectedFolderUids((prevFolders) => {
        const willSelect = !prevFolders.has(uid);
        const nextFolders = new Set(prevFolders);
        if (willSelect) {
          nextFolders.add(uid);
        } else {
          nextFolders.delete(uid);
        }
        // Cascade: selecting a folder selects every dashboard in its subtree;
        // deselecting it removes them. Other selected folders sharing
        // descendants will be re-cascaded if the user re-toggles them.
        setSelectedDashboardUids((prevDashes) => {
          const nextDashes = new Set(prevDashes);
          if (willSelect) {
            cascadeUids.forEach((d) => nextDashes.add(d));
          } else {
            cascadeUids.forEach((d) => nextDashes.delete(d));
          }
          return nextDashes;
        });
        return nextFolders;
      });
    },
    [folders]
  );

  const toggleDashboard = useCallback((uid: string) => {
    setSelectedDashboardUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }, []);

  const selectAllFolders = useCallback(() => {
    setSelectedFolderUids(new Set(folders.filter((f) => !f.managedBy).map((f) => f.uid)));
  }, [folders]);

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
      <OverviewStatCards totals={totals} folders={folders} />
      <div className={styles.mainGrid}>
        <div className={styles.tableColumn}>
          <QuickWinsPanel
            folders={folders}
            repos={repoList}
            selected={selectedFolderUids}
            onToggle={toggleFolder}
            onSelectAll={selectAllFolders}
          />
          <FoldersToMigrate
            folders={folders}
            repos={repoList}
            selectedFolderUids={selectedFolderUids}
            selectedDashboardUids={selectedDashboardUids}
            onToggleFolder={toggleFolder}
            onToggleDashboard={toggleDashboard}
            onMigrateClick={() => setMigrateDrawerOpen(true)}
          />
        </div>
        <div className={styles.sideColumn}>
          <NextStepsPanel totals={totals} repos={repoList} />
          <ToolingSupportPanel breakdowns={breakdowns} />
        </div>
      </div>
      {migrateDrawerOpen && (
        <MigrateDrawer
          folders={folders}
          repos={repoList}
          selectedFolderUids={selectedFolderUids}
          selectedDashboardUids={selectedDashboardUids}
          onClose={() => setMigrateDrawerOpen(false)}
        />
      )}
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
  toolingGrid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
    gap: theme.spacing(1),
  }),
  toolTile: css({
    position: 'relative',
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
  toolTileInfo: css({
    position: 'absolute',
    top: theme.spacing(0.75),
    right: theme.spacing(0.75),
    color: theme.colors.text.secondary,
    cursor: 'help',
    '&:hover, &:focus-visible': {
      color: theme.colors.text.primary,
    },
  }),
  toolTileInitial: css({
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: 1,
  }),
});
