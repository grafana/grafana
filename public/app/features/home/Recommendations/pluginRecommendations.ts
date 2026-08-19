import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { type LocalPlugin } from 'app/features/plugins/admin/types';

import { APP_OBSERVABILITY_APP_ID, HOSTED_TRACES_APP_ID } from '../solutions/appPluginIds';
import { KUBERNETES_APP_ID } from '../solutions/kubernetesData';
import { createTtlCachedPromise, PROBE_TIMEOUT_MS, PROBE_TTL_MS, withTimeout } from '../solutions/probeUtils';
import { TELEMETRY_SETUP_DOCS, type TelemetryType } from '../solutions/telemetrySetup';

import { type RecommendedCardId } from './solutionsMatrix';
import { type RecommendationItem } from './types';

export interface PluginRecommendationCard extends RecommendationItem {
  kind: 'plugin';
  pluginId: string;
  /** CTA label when the app is already enabled but not receiving data yet. */
  setupAction: string;
  /** CTA target into the app itself, for the enabled-but-no-data state. */
  appHref: string;
  /** Uses signal onboarding instead of the app page when the plugin is enabled but silent. */
  telemetryType?: TelemetryType;
}

/** Guided-connection card: never "enabled-but-silent", so no setup variant. */
interface ConnectionRecommendationCard extends RecommendationItem {
  kind: 'connection';
  /** Uses signal onboarding instead of the card's static href. */
  telemetryType?: TelemetryType;
}

export type RecommendationCardDefinition = PluginRecommendationCard | ConnectionRecommendationCard;

const KUBERNETES_LOGS_SETUP_DOCS =
  'https://grafana.com/docs/grafana-cloud/monitor-infrastructure/kubernetes-monitoring/configuration/';

// appPath: in-app landing route for the setup CTA; empty when the app's root include is its real entry.
function pluginCard(
  definition: Omit<PluginRecommendationCard, 'kind' | 'href' | 'appHref'> & { appPath: string }
): PluginRecommendationCard {
  const { appPath, ...card } = definition;
  return {
    ...card,
    kind: 'plugin',
    href: locationUtil.assureBaseUrl(`/plugins/${card.pluginId}/`),
    appHref: locationUtil.assureBaseUrl(createBridgeURL(card.pluginId, appPath)),
  };
}

/** The cards the matrix can select, keyed by their selection id. */
export function getRecommendationCards(): Record<RecommendedCardId, RecommendationCardDefinition> {
  return {
    'connect-metrics': {
      kind: 'connection',
      telemetryType: 'metrics',
      id: 'connect-metrics',
      icon: 'chart-line',
      color: (theme) => theme.visualization.getColorByName('purple'),
      title: t('home.recommendations.connect-metrics.title', 'Start with metrics'),
      context: t('home.recommendations.connect-metrics.context', 'The foundation of your observability stack'),
      description: t(
        'home.recommendations.connect-metrics.description',
        'Connect a Prometheus-compatible data source or ship metrics with a collector to light up dashboards and alerting.'
      ),
      action: t('home.recommendations.connect-metrics.action', 'Connect metrics'),
      href: TELEMETRY_SETUP_DOCS.metrics,
      cta: 'learn_more',
    },
    'hosted-traces': pluginCard({
      telemetryType: 'traces',
      id: 'hosted-traces',
      pluginId: HOSTED_TRACES_APP_ID,
      appPath: '',
      icon: 'gf-traces',
      color: (theme) => theme.visualization.getColorByName('orange'),
      title: t('home.recommendations.hosted-traces.title', 'Trace requests across services'),
      context: t('home.recommendations.hosted-traces.context', 'Complete the picture with distributed tracing'),
      description: t(
        'home.recommendations.hosted-traces.description',
        'Add distributed tracing to see how requests flow between services and where they slow down.'
      ),
      action: t('home.recommendations.hosted-traces.action', 'Enable Hosted Traces'),
      setupAction: t('home.recommendations.hosted-traces.setup-action', 'Set up Hosted Traces'),
    }),
    'application-observability': pluginCard({
      id: 'application-observability',
      pluginId: APP_OBSERVABILITY_APP_ID,
      appPath: '',
      icon: 'application-observability',
      color: (theme) => theme.visualization.getColorByName('green'),
      title: t('home.recommendations.application-observability.title', 'Explore your service map'),
      context: t('home.recommendations.application-observability.context', 'Built automatically from your telemetry'),
      description: t(
        'home.recommendations.application-observability.description',
        'Turn OpenTelemetry data into RED metrics, service maps, and correlated traces automatically.'
      ),
      action: t('home.recommendations.application-observability.action', 'Enable Application Observability'),
      setupAction: t('home.recommendations.application-observability.setup-action', 'Set up Application Observability'),
    }),
    'kubernetes-monitoring': pluginCard({
      id: 'kubernetes-monitoring',
      pluginId: KUBERNETES_APP_ID,
      appPath: '',
      icon: 'kubernetes',
      color: (theme) => theme.visualization.getColorByName('blue'),
      title: t('home.recommendations.kubernetes-monitoring.title', 'Monitor your Kubernetes fleet'),
      context: t(
        'home.recommendations.kubernetes-monitoring.context',
        'Cluster health next to your existing telemetry'
      ),
      description: t(
        'home.recommendations.kubernetes-monitoring.description',
        'Deploy the Helm chart to get pod, node, and workload health out of the box.'
      ),
      action: t('home.recommendations.kubernetes-monitoring.action', 'Enable Kubernetes Monitoring'),
      setupAction: t('home.recommendations.kubernetes-monitoring.setup-action', 'Set up Kubernetes Monitoring'),
    }),
    // Copy is deployment-neutral on purpose: metrics activity does not prove which collector produced it.
    'enable-logs': {
      kind: 'connection',
      telemetryType: 'logs',
      id: 'enable-logs',
      icon: 'gf-logs',
      color: (theme) => theme.visualization.getColorByName('green'),
      title: t('home.recommendations.enable-logs.title', 'See the story behind your metrics'),
      context: t('home.recommendations.enable-logs.context', 'Correlate spikes with the logs that explain them'),
      description: t(
        'home.recommendations.enable-logs.description',
        'Send logs alongside your metrics to explain anomalies. Use your existing collector or follow a guided connection.'
      ),
      action: t('home.recommendations.enable-logs.action', 'Add Logs'),
      href: TELEMETRY_SETUP_DOCS.logs,
      cta: 'learn_more',
    },
    'enable-logs-k8s': {
      kind: 'connection',
      id: 'enable-logs-k8s',
      icon: 'gf-logs',
      color: (theme) => theme.visualization.getColorByName('green'),
      title: t('home.recommendations.enable-logs-k8s.title', 'Turn on logs for your clusters'),
      context: t(
        'home.recommendations.enable-logs-k8s.context',
        'Pod logs next to the cluster metrics you already have'
      ),
      description: t(
        'home.recommendations.enable-logs-k8s.description',
        'Add pod logs alongside your cluster metrics. If you use the Grafana Kubernetes Monitoring Helm chart, log collection is a single values flag.'
      ),
      action: t('home.recommendations.enable-logs-k8s.action', 'Set up log collection'),
      href: KUBERNETES_LOGS_SETUP_DOCS,
      cta: 'learn_more',
    },
  };
}

// Bypass getLocalPlugins(): it drops hidden plugins, which must still be classified here.
// Share the response because Overview and Recommendations request the same large inventory.
const installedPlugins = createTtlCachedPromise(
  () =>
    withTimeout(
      getBackendSrv().get<LocalPlugin[]>('/api/plugins', accessControlQueryParam({ embedded: 0 }), undefined, {
        showErrorAlert: false,
      }),
      PROBE_TIMEOUT_MS
    ),
  PROBE_TTL_MS
);

export function fetchInstalledPlugins(): Promise<LocalPlugin[]> {
  return installedPlugins.get();
}

export function resetInstalledPlugins(): void {
  installedPlugins.reset();
}
