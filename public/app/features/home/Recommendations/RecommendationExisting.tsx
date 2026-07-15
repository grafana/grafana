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
  fetchKubernetesHealth,
  fetchKubernetesInventory,
  hasHealthProblems,
  KUBERNETES_APP_ID,
  resolveKubernetesDatasource,
  type KubernetesHealth,
  type KubernetesInventory,
} from './kubernetesData';

// Browser locale is the deliberate choice: the homepage number format follows the user's environment.
const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

interface ExistingItem {
  title: string;
  icon: IconName;
  stats?: { primary: string; secondary: string };
  statsLoading?: boolean;
  sparkline?: SolutionSparklineData;
  sparklineLoading?: boolean;
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

function useKubernetesCardData() {
  const { value: datasource, loading: resolving, error: resolutionError } = useAsync(resolveKubernetesDatasource, []);
  const { value: inventory, loading: inventoryLoading, error: inventoryError } = useAsync(fetchKubernetesInventory, []);
  const { value: health, loading: healthLoading, error: healthError } = useAsync(fetchKubernetesHealth, []);
  const { value: cpuSeries, loading: cpuLoading } = useAsync(fetchClusterCpuSeries, []);
  return {
    datasource,
    resolving,
    resolutionError,
    inventory,
    inventoryLoading,
    inventoryError,
    health,
    healthLoading,
    healthError,
    cpuSeries,
    cpuLoading,
  };
}

/** Build the Kubernetes Monitoring entry from live Prometheus data. */
function buildKubernetesItem(
  parts: {
    inventory: KubernetesInventory | undefined;
    inventoryLoading: boolean;
    health: KubernetesHealth | undefined;
    cpuSeries: FieldSparkline | null | undefined;
    cpuLoading: boolean;
  },
  settings: PluginMeta<{}>
): ExistingItem {
  const bridgePath = createBridgeURL(KUBERNETES_APP_ID, '/home');
  const href = locationUtil.assureBaseUrl(bridgePath);
  const alertsBridgePath = createBridgeURL(KUBERNETES_APP_ID, '/alerts');
  const alertsHref = canAccessPluginPage(settings, alertsBridgePath)
    ? locationUtil.assureBaseUrl(alertsBridgePath)
    : href;

  const { inventory, inventoryLoading, health, cpuSeries, cpuLoading } = parts;

  const healthRows: string[] = [];
  if (health) {
    if (health.unhealthyPods !== null && health.unhealthyPods > 0) {
      healthRows.push(
        t('home.recommendations.health.pods', '', {
          count: Math.ceil(health.unhealthyPods),
          defaultValue_one: '{{count}} pod pending or failed',
          defaultValue_other: '{{count}} pods pending or failed',
        })
      );
    }
    if (health.restarts1h !== null && health.restarts1h > 0) {
      healthRows.push(
        t('home.recommendations.health.restarts', '', {
          count: Math.ceil(health.restarts1h),
          defaultValue_one: '{{count}} restart in the last hour',
          defaultValue_other: '{{count}} restarts in the last hour',
        })
      );
    }
    if (health.notReadyNodes !== null && health.notReadyNodes > 0) {
      healthRows.push(
        t('home.recommendations.health.nodes', '', {
          count: Math.ceil(health.notReadyNodes),
          defaultValue_one: '{{count}} node not ready',
          defaultValue_other: '{{count}} nodes not ready',
        })
      );
    }
  }

  const alertsFiring = health?.alertsFiring ?? 0;
  const showAlert = health !== undefined && hasHealthProblems(health) === true;

  const clusterCount = inventory ? Math.ceil(inventory.clusters) : 0;
  const podCount = inventory ? Math.ceil(inventory.pods) : 0;
  const hasInventoryStats = inventory !== undefined && (clusterCount > 0 || podCount > 0);

  return {
    title: t('home.recommendations.kubernetes.title', 'Kubernetes Monitoring'),
    icon: 'kubernetes',
    stats: hasInventoryStats
      ? {
          primary: t('home.recommendations.kubernetes.clusters', '', {
            count: clusterCount,
            value: compactFormatter.format(clusterCount),
            defaultValue_one: '{{value}} cluster',
            defaultValue_other: '{{value}} clusters',
          }),
          secondary: t('home.recommendations.kubernetes.pods', '', {
            count: podCount,
            value: compactFormatter.format(podCount),
            defaultValue_one: '{{value}} pod',
            defaultValue_other: '{{value}} pods',
          }),
        }
      : undefined,
    statsLoading: inventoryLoading,
    sparkline: cpuSeries
      ? {
          series: cpuSeries,
          caption: t('home.recommendations.kubernetes.cluster-cpu', 'Cluster CPU · last 24h'),
        }
      : undefined,
    sparklineLoading: cpuLoading,
    alert: showAlert
      ? {
          primary:
            alertsFiring > 0
              ? t('home.recommendations.kubernetes.alerts-firing', '', {
                  count: Math.ceil(alertsFiring),
                  value: compactFormatter.format(Math.ceil(alertsFiring)),
                  defaultValue_one: '{{value}} alert firing',
                  defaultValue_other: '{{value}} alerts firing',
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
  const {
    datasource,
    resolving,
    resolutionError,
    inventory,
    inventoryLoading,
    inventoryError,
    health,
    healthLoading,
    healthError,
    cpuSeries,
    cpuLoading,
  } = useKubernetesCardData();

  const [selectedTitle, setSelectedTitle] = useState<string>();

  const bridgePath = createBridgeURL(KUBERNETES_APP_ID, '/home');
  const canAccessK8s = settings && canAccessPluginPage(settings, bridgePath);

  if (!settingsLoading && !canAccessK8s) {
    const existing = stubbedExisting;
    const selected = existing.find((item) => item.title === selectedTitle) ?? existing[0];
    return renderExistingCard(existing, selected, styles, setSelectedTitle);
  }

  if (settingsLoading || resolving) {
    return <RecommendationExistingSkeleton />;
  }

  const inventoryFailed = !inventoryLoading && Boolean(inventoryError);
  const healthFailed = !healthLoading && Boolean(healthError);

  let kubernetesItem: ExistingItem | null = null;
  if (!resolutionError && datasource && settings) {
    if (!(inventoryFailed && healthFailed)) {
      kubernetesItem = buildKubernetesItem(
        {
          inventory,
          inventoryLoading,
          health,
          cpuSeries: cpuSeries ?? null,
          cpuLoading,
        },
        settings
      );
    }
  }

  const existing = kubernetesItem ? [kubernetesItem, ...stubbedExisting] : stubbedExisting;
  const selected = existing.find((item) => item.title === selectedTitle) ?? existing[0];

  return renderExistingCard(existing, selected, styles, setSelectedTitle);
}

function renderExistingCard(
  existing: ExistingItem[],
  selected: ExistingItem,
  styles: ReturnType<typeof getStyles>,
  setSelectedTitle: (title: string) => void
) {
  const showStatsSparklineRow =
    selected.statsLoading || selected.sparklineLoading || selected.stats || selected.sparkline;

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
        {showStatsSparklineRow && (
          <Stack direction="row" gap={2} alignItems="center">
            {(selected.statsLoading || selected.stats) && (
              <div className={styles.stats}>
                {selected.statsLoading ? (
                  <Stack direction="column" gap={0} data-testid="kubernetes-stats-skeleton">
                    <Skeleton width={96} height={28} />
                    <Skeleton width={72} />
                  </Stack>
                ) : (
                  selected.stats && (
                    <Stack direction="column" gap={0}>
                      <Text variant="h2" color="primary">
                        {selected.stats.primary}
                      </Text>
                      <Text variant="body" color="secondary">
                        {selected.stats.secondary}
                      </Text>
                    </Stack>
                  )
                )}
              </div>
            )}

            {selected.sparklineLoading ? (
              <div className={styles.sparklineArea} data-testid="kubernetes-sparkline-skeleton">
                <Skeleton height={56} />
              </div>
            ) : (
              selected.sparkline && (
                <div className={styles.sparklineArea}>
                  <SolutionSparkline sparkline={selected.sparkline} />
                </div>
              )
            )}
          </Stack>
        )}

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
  metaRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing(1.5),
    rowGap: 0,
    overflow: 'hidden',
  }),
  stats: css({
    flexShrink: 0,
  }),
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
