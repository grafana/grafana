import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { useIrmPlugin, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { HostedLogsCard } from '../../AlertsIncidents/HostedLogsCard';
import { HostedMetricsCard } from '../../AlertsIncidents/HostedMetricsCard';
import { IncidentsCard } from '../../AlertsIncidents/IncidentsCard';
import { KubernetesOverviewCard, KUBERNETES_APP_ID } from '../../AlertsIncidents/KubernetesOverviewCard';
import { OnCallCard } from '../../AlertsIncidents/OnCallCard';
import { SlosCard } from '../../AlertsIncidents/SlosCard';
import { type HomeWidgetCatalogEntry } from '../types';

/** Active incidents — gated on the IRM (or legacy Incident) plugin being installed. */
export function useIncidentsWidget(): HomeWidgetCatalogEntry | null {
  const { loading, installed } = useIrmPlugin(SupportedPlugin.Incident);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'incidents',
    title: t('home.widgets.incidents.title', 'Active incidents'),
    description: t('home.widgets.incidents.description', 'Incidents currently active in your IRM app'),
    icon: 'bell',
    source: 'curated',
    defaultSize: { w: 12, h: 8 },
    minSize: { w: 8, h: 6 },
    render: () => <IncidentsCard />,
  };
}

/** On-call shifts — gated on the IRM (or legacy OnCall) plugin being installed. */
export function useOnCallWidget(): HomeWidgetCatalogEntry | null {
  const { loading, installed } = useIrmPlugin(SupportedPlugin.OnCall);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'oncall',
    title: t('home.widgets.oncall.title', 'On-call shifts'),
    description: t('home.widgets.oncall.description', 'Who is on call right now'),
    icon: 'clock-nine',
    source: 'curated',
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 6, h: 4 },
    render: () => <OnCallCard />,
  };
}

/** Kubernetes overview — gated on the Kubernetes Monitoring app being installed. */
export function useKubernetesWidget(): HomeWidgetCatalogEntry | null {
  const { loading, installed } = usePluginBridge(KUBERNETES_APP_ID);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'kubernetes',
    title: t('home.widgets.kubernetes.title', 'Kubernetes Monitoring'),
    description: t('home.widgets.kubernetes.description', 'Overview of clusters monitored by the Kubernetes app'),
    icon: 'kubernetes',
    source: 'curated',
    defaultSize: { w: 8, h: 7 },
    minSize: { w: 6, h: 4 },
    render: () => <KubernetesOverviewCard />,
  };
}

// getDataSourceSrv() is the bootstrap singleton and can be unset during very early render or in tests
// that do not configure datasources; treat an unavailable registry as "no datasources" so a gate hook
// never throws while the home page renders.
function hasDataSourceOfType(type: string): boolean {
  const srv: ReturnType<typeof getDataSourceSrv> | undefined = getDataSourceSrv();
  return Boolean(srv && srv.getList({ type }).length);
}

/** Hosted Metrics — gated on a Prometheus datasource being configured. */
export function useHostedMetricsWidget(): HomeWidgetCatalogEntry | null {
  if (!hasDataSourceOfType('prometheus')) {
    return null;
  }
  return {
    id: 'hosted-metrics',
    title: t('home.widgets.hosted-metrics.title', 'Hosted Metrics'),
    description: t('home.widgets.hosted-metrics.description', 'Active series and ingest from your Prometheus'),
    icon: 'chart-line',
    source: 'curated',
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 6, h: 4 },
    render: () => <HostedMetricsCard />,
  };
}

/** Hosted Logs — gated on a Loki datasource being configured. */
export function useHostedLogsWidget(): HomeWidgetCatalogEntry | null {
  if (!hasDataSourceOfType('loki')) {
    return null;
  }
  return {
    id: 'hosted-logs',
    title: t('home.widgets.hosted-logs.title', 'Hosted Logs'),
    description: t('home.widgets.hosted-logs.description', 'Ingestion and sources from your Loki'),
    icon: 'gf-logs',
    source: 'curated',
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 6, h: 4 },
    render: () => <HostedLogsCard />,
  };
}

/** SLOs — gated on the Grafana SLO app being installed. */
export function useSlosWidget(): HomeWidgetCatalogEntry | null {
  const { loading, installed } = usePluginBridge(SupportedPlugin.Slo);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'slos',
    title: t('home.widgets.slos.title', 'SLOs'),
    description: t('home.widgets.slos.description', 'Availability and error budget'),
    icon: 'heart-rate',
    source: 'curated',
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 6, h: 4 },
    render: () => <SlosCard />,
  };
}
