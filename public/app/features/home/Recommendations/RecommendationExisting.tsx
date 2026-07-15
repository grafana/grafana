import { css, cx } from '@emotion/css';
import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useAsync } from 'react-use';

import { type FieldSparkline, type IconName, type GrafanaTheme2, type PluginMeta, locationUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import SolutionSparkline, { type SolutionSparklineData } from './SolutionSparkline';
import {
  fetchClusterCpuSeries,
  fetchKubernetesOverview,
  hasHealthProblems,
  KUBERNETES_APP_ID,
  type KubernetesOverview,
} from './kubernetesData';

interface ExistingItem {
  title: string;
  icon: IconName;
  stats: {
    primary: string;
    secondary: string;
  };
  // Absent when the solution has no time series to show (e.g. the stubs, or the metric is missing).
  sparkline?: SolutionSparklineData;
  // Absent when the solution is healthy — real data only alerts when something is wrong.
  // `secondary` is a list of detail segments so separators can be drawn (and dropped) per segment.
  alert?: {
    primary: string;
    secondary?: string[];
    action: string;
    href: string;
  };
  action: string;
  href: string;
}

// Stubbed data for initial development — placeholders until these solutions get a real data layer
// like the Kubernetes item built in buildKubernetesItem below.
const stubbedExisting: ExistingItem[] = [
  {
    title: 'Hosted Metrics',
    icon: 'chart-line',
    stats: {
      primary: '4.2M series',
      secondary: '12 hosts',
    },
    alert: {
      primary: '3 hosts above 90% disk',
      secondary: ['web-03 critical at 96%, ~6 h to full'],
      action: 'View',
      href: '#',
    },
    action: 'Open infrastructure',
    href: '#',
  },
  {
    title: 'Hosted Logs',
    icon: 'file-alt',
    stats: {
      primary: '47 GB ingested',
      secondary: '8 sources',
    },
    alert: {
      primary: 'Ingest spike detected',
      secondary: ['checkout-service logs up 3x in the last hour'],
      action: 'View',
      href: '#',
    },
    action: 'Open Explore (Logs)',
    href: '#',
  },
];

/**
 * Build the Kubernetes Monitoring entry from live Prometheus data. Returns null when the user
 * cannot access the app's home page — an entry whose every action dead-ends is worse than none.
 */
function buildKubernetesItem(
  overview: KubernetesOverview,
  cpuSeries: FieldSparkline | null,
  settings?: PluginMeta<{}>
): ExistingItem | null {
  const bridgePath = createBridgeURL(KUBERNETES_APP_ID, '/home');
  if (!settings || !canAccessPluginPage(settings, bridgePath)) {
    return null;
  }
  // Wrap the raw /a/... bridge paths so copy-link / open-in-new-tab is correct under config.appSubUrl.
  const href = locationUtil.assureBaseUrl(bridgePath);
  // The alert strip's View drills into the app's alerts page; fall back to the app home if the
  // include role/action semantics deny that specific page.
  const alertsBridgePath = createBridgeURL(KUBERNETES_APP_ID, '/alerts');
  const alertsHref = canAccessPluginPage(settings, alertsBridgePath)
    ? locationUtil.assureBaseUrl(alertsBridgePath)
    : href;

  // Filter on the RAW signal (>0), display with Math.ceil: a 0.4 restart signal still counts as a
  // problem but must not round to "0 restarts", and increase() yields fractions we never want to show.
  const healthRows: string[] = [];
  if (overview.unhealthyPods !== null && overview.unhealthyPods > 0) {
    healthRows.push(
      t('home.recommendations.health.pods', '', {
        count: Math.ceil(overview.unhealthyPods),
        defaultValue_one: '{{count}} pod pending or failed',
        defaultValue_other: '{{count}} pods pending or failed',
      })
    );
  }
  if (overview.restarts1h !== null && overview.restarts1h > 0) {
    healthRows.push(
      t('home.recommendations.health.restarts', '', {
        count: Math.ceil(overview.restarts1h),
        defaultValue_one: '{{count}} restart in the last hour',
        defaultValue_other: '{{count}} restarts in the last hour',
      })
    );
  }
  if (overview.notReadyNodes !== null && overview.notReadyNodes > 0) {
    healthRows.push(
      t('home.recommendations.health.nodes', '', {
        count: Math.ceil(overview.notReadyNodes),
        defaultValue_one: '{{count}} node not ready',
        defaultValue_other: '{{count}} nodes not ready',
      })
    );
  }

  const alertsFiring = overview.alertsFiring ?? 0;
  // Every positive signal contributes either the firing count or a health row, so a problem verdict
  // always has content to show.
  const showAlert = hasHealthProblems(overview) === true;

  return {
    title: t('home.recommendations.kubernetes.title', 'Kubernetes Monitoring'),
    icon: 'kubernetes',
    // Counts are count()-derived and integral in theory; Math.ceil guards the display against a datasource returning fractional frames.
    stats: {
      primary: t('home.recommendations.kubernetes.clusters', '', {
        count: Math.ceil(overview.clusters),
        defaultValue_one: '{{count}} cluster',
        defaultValue_other: '{{count}} clusters',
      }),
      secondary: t('home.recommendations.kubernetes.pods', '', {
        count: Math.ceil(overview.pods),
        defaultValue_one: '{{count}} pod',
        defaultValue_other: '{{count}} pods',
      }),
    },
    sparkline: cpuSeries
      ? {
          series: cpuSeries,
          caption: t('home.recommendations.kubernetes.cluster-cpu', 'Cluster CPU · last 24h'),
        }
      : undefined,
    alert: showAlert
      ? {
          // The firing-alert count leads when present (matching the design); health rows follow as
          // the detail line. Without firing alerts the worst health row takes the lead instead.
          primary:
            alertsFiring > 0
              ? t('home.recommendations.kubernetes.alerts-firing', '', {
                  count: Math.ceil(alertsFiring),
                  defaultValue_one: '{{count}} alert firing',
                  defaultValue_other: '{{count}} alerts firing',
                })
              : healthRows[0],
          secondary: alertsFiring > 0 ? healthRows : healthRows.slice(1),
          action: t('home.recommendations.kubernetes.view', 'View'),
          href: alertsHref,
        }
      : undefined,
    action: t('home.recommendations.kubernetes.action', 'Open K8s app'),
    href,
  };
}

export function RecommendationExisting() {
  const styles = useStyles2(getStyles);
  const { settings, loading: settingsLoading } = usePluginBridge(KUBERNETES_APP_ID);
  // Resolved from Prometheus (kube-state-metrics), not a plugin REST endpoint — the k8s app has no
  // summary API. While settings and the overview load the card shows a skeleton; on error or no data the
  // entry is omitted and the stubs remain.
  const { value: overview, loading: overviewLoading } = useAsync(fetchKubernetesOverview, []);
  // Fetched separately so a missing or slow cAdvisor metric only costs the chart, never the whole entry.
  const { value: cpuSeries } = useAsync(fetchClusterCpuSeries, []);

  // Track selection by title so it survives the Kubernetes item appearing once its data resolves;
  // storing the item object would go stale when the list is rebuilt.
  const [selectedTitle, setSelectedTitle] = useState<string>();

  if (settingsLoading || overviewLoading) {
    return <RecommendationExistingSkeleton />;
  }

  const kubernetesItem =
    overview && overview.clusters > 0 ? buildKubernetesItem(overview, cpuSeries ?? null, settings) : null;
  const existing = kubernetesItem ? [kubernetesItem, ...stubbedExisting] : stubbedExisting;
  const selected = existing.find((item) => item.title === selectedTitle) ?? existing[0];

  if (!selected) {
    return null;
  }

  return (
    <Stack direction="column" justifyContent="space-between" gap={2} flex={1}>
      <Stack direction="column" gap={1.5}>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Group label={t('home.recommendations.switch', 'Recommendations follow the selected solution')}>
                {existing.map((item) => (
                  <Menu.Item
                    key={item.title}
                    label={item.title}
                    icon={item.icon}
                    onClick={() => setSelectedTitle(item.title)}
                    component={item.title === selected.title ? SelectedCheck : undefined}
                  />
                ))}
              </Menu.Group>
            </Menu>
          }
        >
          <Button variant="secondary" fill="outline" size="sm" className={styles.dropdown}>
            <Stack direction="row" gap={1} alignItems="center">
              <Text variant="bodySmall" color="secondary">
                <span className={styles.subtitle}>
                  <Trans i18nKey="home.recommendations.existing">Enabled solution</Trans>
                </span>
              </Text>

              <Text variant="bodySmall" color="primary" weight="medium">
                <Trans i18nKey="home.recommendations.switchSolution">Switch solution</Trans>
              </Text>

              <Icon name="angle-down" className={styles.chevron} />
            </Stack>
          </Button>
        </Dropdown>

        <Stack direction="row" alignItems="center" gap={1.5}>
          <div className={styles.icon}>
            <Icon name={selected.icon} size="lg" />
          </div>

          <Text variant="h3" color="primary" role="heading" aria-level={3}>
            {selected.title}
          </Text>
        </Stack>
      </Stack>

      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={2} alignItems="center">
          <div className={styles.stats}>
            <Stack direction="column" gap={0}>
              <Text variant="h2" color="primary">
                {selected.stats.primary}
              </Text>
              <Text variant="body" color="secondary">
                {selected.stats.secondary}
              </Text>
            </Stack>
          </div>

          {selected.sparkline && (
            <div className={styles.sparklineArea}>
              <SolutionSparkline sparkline={selected.sparkline} />
            </div>
          )}
        </Stack>

        {selected.alert && (
          <div className={styles.alert}>
            <Stack direction="row" alignItems="center" gap={1.5}>
              <Icon name="exclamation-triangle" size="md" className={styles.warning} />

              <div className={cx(styles.metaRow, styles.alertText)}>
                <span className={styles.segment}>
                  <Text variant="body" color="primary">
                    {selected.alert.primary}
                  </Text>
                </span>
                {selected.alert.secondary?.map((segment, i) => (
                  <span key={i} className={styles.segment}>
                    <Text variant="body" color="secondary">
                      {segment}
                    </Text>
                  </span>
                ))}
              </div>

              <LinkButton
                variant="secondary"
                size="sm"
                fill="text"
                icon="angle-right"
                iconPlacement="right"
                href={selected.alert.href}
              >
                {selected.alert.action}
              </LinkButton>
            </Stack>
          </div>
        )}
      </Stack>

      <Stack direction="row" alignItems="center">
        <LinkButton
          variant="secondary"
          size="md"
          fill="solid"
          icon="arrow-right"
          iconPlacement="right"
          href={selected.href}
        >
          {selected.action}
        </LinkButton>
      </Stack>
    </Stack>
  );
}

// Mirrors the card body (dropdown pill, icon + title, stats, CTA) while the Kubernetes lookups
// load, so the first paint never shows a solution that a resolving fetch would replace.
function RecommendationExistingSkeleton() {
  return (
    <Stack
      direction="column"
      justifyContent="space-between"
      gap={2}
      flex={1}
      data-testid="recommendation-existing-skeleton"
    >
      <Stack direction="column" gap={1.5}>
        <Skeleton width={240} height={30} />
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Skeleton width={44} height={44} />
          <Skeleton width={200} height={24} />
        </Stack>
      </Stack>

      <Stack direction="column" gap={0}>
        <Skeleton width={140} height={35} />
        <Skeleton width={100} height={20} />
      </Stack>

      <Stack direction="row" alignItems="center">
        <Skeleton width={170} height={32} />
      </Stack>
    </Stack>
  );
}

// Marks the currently selected solution in the switch menu; the active row carries no highlight.
function SelectedCheck() {
  const styles = useStyles2(getStyles);
  return <Icon name="check" className={styles.selectedCheck} aria-hidden />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Wrapping metadata row whose '·' separators are drawn inside the column gap by each non-first
  // segment; overflow-hidden clips the dot of a segment that starts a new line, so wrapped lines
  // never lead with an orphaned separator.
  metaRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing(1.5),
    rowGap: 0,
    overflow: 'hidden',
  }),
  // The stat numbers must never be squeezed by the chart; the chart absorbs all remaining width.
  stats: css({
    flexShrink: 0,
  }),
  // minWidth 0 lets the flex item actually shrink so SolutionSparkline's ResizeObserver measures
  // the real available width instead of overflowing the card.
  sparklineArea: css({
    flex: '1 1 auto',
    minWidth: 0,
  }),
  alertText: css({
    flex: '1 1 auto',
    minWidth: 0,
  }),
  segment: css({
    position: 'relative',

    '&:not(:first-child)::before': {
      content: '"·"',
      position: 'absolute',
      left: theme.spacing(-1.25),
      color: theme.colors.text.secondary,
    },
  }),
  dropdown: css({
    alignSelf: 'flex-start',
    height: 'auto',
    padding: theme.spacing(0.75, 1.5),
  }),
  chevron: css({
    color: theme.colors.text.secondary,

    '[aria-expanded="true"] &': {
      transform: 'rotate(180deg)',
    },
  }),
  // Right-center check over the menu item (position:relative); selectedBorder is the selection accent.
  selectedCheck: css({
    position: 'absolute',
    right: theme.spacing(1.5),
    top: '50%',
    transform: 'translateY(-50%)',
    color: theme.colors.action.selectedBorder,
  }),
  icon: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    color: theme.colors.text.secondary,
    padding: theme.spacing(1.5),
    lineHeight: 0,
  }),
  subtitle: css({
    textTransform: 'uppercase',
    letterSpacing: theme.spacing(0.125),
    opacity: 0.75,
  }),
  alert: css({
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  warning: css({
    color: theme.colors.warning.main,
    margin: theme.spacing(0, 0, 0, 0.5),
  }),
});
