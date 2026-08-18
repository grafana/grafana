import memoize from 'micro-memoize';

import {
  formattedValueToString,
  getValueFormat,
  locationUtil,
  serializeStateToUrlParam,
  type DataSourceInstanceListItem,
  urlUtil,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { METRICS_DRILLDOWN_APP_ID } from './appPluginIds';
import { resolveKubernetesDatasource } from './kubernetesData';
import { type Solution } from './model';
import { drilldownActiveCta } from './pluginPages';
import { CLOUD_UTILITY_PROM_DATASOURCE_UIDS, labelRecencyProbe, probeFound } from './solutionDataProbes';
import { solutionOffer } from './solutionOffer';
import { detectSignal, type SignalDetection } from './solutionState';
import {
  fetchMetricsActivity,
  fetchMetricsDiskHoursToFull,
  fetchMetricsDiskPressure,
  METRICS_DISK_PRESSURE_QUERY,
} from './telemetryData';
import { getTelemetrySetupCta, getTelemetrySetupLearnMore } from './telemetrySetup';

const formatUsageNumber = getValueFormat('short');

const prometheusHasRecentLabels = labelRecencyProbe('api/v1/labels', (ms) => Math.floor(ms / 1000));

function diskPressureExploreHref(ds: Pick<DataSourceInstanceListItem, 'uid' | 'type'>): string {
  return urlUtil.renderUrl(locationUtil.assureBaseUrl('/explore'), {
    left: serializeStateToUrlParam({
      datasource: ds.uid,
      queries: [
        {
          refId: 'A',
          datasource: { uid: ds.uid, type: ds.type },
          expr: `sort_desc(${METRICS_DISK_PRESSURE_QUERY})`,
        },
      ],
      range: { from: 'now-6h', to: 'now' },
    }),
  });
}

export function metricsSolution(): Solution {
  const prometheus = memoize(() =>
    detectSignal(() => probeFound('prometheus', prometheusHasRecentLabels, CLOUD_UTILITY_PROM_DATASOURCE_UIDS))
  );
  // Kubernetes telemetry is Prometheus data, so it proves metrics too. Keep this as an independent
  // probe so the metrics solution does not depend on the Kubernetes card.
  const kubernetesPrometheus = memoize(() => detectSignal(resolveKubernetesDatasource));

  const detect = memoize(async (): Promise<SignalDetection> => {
    const metricsPromise = prometheus();
    const kubernetesPromise = kubernetesPrometheus();

    const metrics = await metricsPromise;
    if (metrics.status === 'active') {
      return metrics;
    }

    const kubernetes = await kubernetesPromise;
    if (kubernetes.status === 'active') {
      return kubernetes;
    }

    return metrics.status === 'unknown' || kubernetes.status === 'unknown'
      ? { status: 'unknown', datasource: null }
      : { status: 'inactive', datasource: null };
  });
  const datasource = async () => (await detect()).datasource;

  const activity = memoize(async () => {
    const ds = await datasource();
    return ds ? fetchMetricsActivity(ds) : null;
  });
  const diskPressure = memoize(async () => {
    const ds = await datasource();
    return ds ? fetchMetricsDiskPressure(ds) : null;
  });
  const diskHoursToFull = memoize(async () => {
    const ds = await datasource();
    const disk = await diskPressure();
    return ds && disk?.worstInstance && disk.worstMount
      ? fetchMetricsDiskHoursToFull(disk.worstInstance, disk.worstMount, ds)
      : null;
  });

  const signal = async () => (await detect()).status;
  const needsAttention = async () => (await diskPressure()) !== null;

  return {
    id: 'metrics',
    icon: 'chart-line',
    title: t('home.solutions.metrics.title', 'Metrics & infrastructure'),
    signal,
    datasource,
    needsAttention,
    offer: solutionOffer(signal, {
      appId: METRICS_DRILLDOWN_APP_ID,
      description: t(
        'home.solutions.metrics.description',
        'Connect Prometheus-compatible metrics to explore infrastructure health and trends.'
      ),
      setupHint: t('home.solutions.metrics.setup-hint', 'connect a metrics source'),
      setupCta: async (capabilities) => getTelemetrySetupCta('metrics', capabilities),
      getLearnMore: (capabilities) => getTelemetrySetupLearnMore('metrics', capabilities),
    }),
    refinedStats: async () => null,
    alert: async () => {
      const ds = await datasource();
      if (!ds) {
        return null;
      }
      const disk = await diskPressure();
      if (!disk || disk.hostsAbove < 1) {
        return null;
      }

      const details: string[] = [];
      if (disk.worstInstance && disk.worstRatio != null) {
        details.push(
          t('home.solutions.metrics.disk-worst', '{{host}} at {{percent}}%', {
            host: disk.worstInstance.replace(/:\d+$/, ''),
            percent: Math.round(disk.worstRatio * 100),
          })
        );
      }
      const hoursToFull = await diskHoursToFull();
      if (hoursToFull != null) {
        details.push(
          t('home.solutions.metrics.disk-eta', '', {
            count: Math.max(1, Math.round(hoursToFull)),
            defaultValue_one: '~{{count}} h to full',
            defaultValue_other: '~{{count}} h to full',
          })
        );
      }

      return {
        primary: t('home.solutions.metrics.disk-hosts', '', {
          count: disk.hostsAbove,
          defaultValue_one: '{{count}} host above 90% disk',
          defaultValue_other: '{{count}} hosts above 90% disk',
        }),
        details,
        cta: {
          label: t('home.solutions.metrics.investigate-disk', 'Investigate disk usage in Explore'),
          href: diskPressureExploreHref(ds),
        },
      };
    },
    stats: async () => {
      const metrics = await activity();
      if (!metrics) {
        return null;
      }
      const secondary =
        metrics.dataPointsPerMinute != null
          ? t('home.solutions.metrics.data-points-per-minute', '{{value}} data points/min', {
              value: formattedValueToString(formatUsageNumber(Math.ceil(metrics.dataPointsPerMinute))),
            })
          : metrics.hosts != null
            ? t('home.solutions.metrics.stats-hosts', '', {
                count: metrics.hosts,
                defaultValue_one: 'active · {{count}} host',
                defaultValue_other: 'active · {{count}} hosts',
              })
            : t('home.solutions.metrics.stats', 'active');

      if (metrics.series != null) {
        return {
          primary: t('home.solutions.metrics.series', '', {
            count: Math.ceil(metrics.series),
            value: formattedValueToString(formatUsageNumber(Math.ceil(metrics.series))),
            defaultValue_one: '{{value}} series',
            defaultValue_other: '{{value}} series',
          }),
          secondary,
        };
      }
      if (metrics.names != null) {
        return {
          primary: t('home.solutions.metrics.names', '', {
            count: Math.ceil(metrics.names),
            value: formattedValueToString(formatUsageNumber(Math.ceil(metrics.names))),
            defaultValue_one: '{{value}} metric',
            defaultValue_other: '{{value}} metrics',
          }),
          secondary,
        };
      }
      return null;
    },
    sparkline: async () => {
      const metrics = await activity();
      return metrics?.seriesSparkline
        ? {
            series: metrics.seriesSparkline,
            caption: t('home.solutions.metrics.series-trend', 'Active series · last 24h'),
          }
        : null;
    },
    cta: async () => {
      const ds = await datasource();
      if (!ds) {
        return null;
      }
      return drilldownActiveCta(
        ds,
        METRICS_DRILLDOWN_APP_ID,
        'Metrics Drilldown',
        `/a/${METRICS_DRILLDOWN_APP_ID}/drilldown`
      );
    },
  };
}
