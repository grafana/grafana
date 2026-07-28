import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { type LocalPlugin } from 'app/features/plugins/admin/types';

import { HOSTED_TRACES_APP_ID } from './appPluginIds';
import { KUBERNETES_APP_ID } from './kubernetesData';
import { type RecommendedCardId } from './solutionsMatrix';
import { type RecommendationItem } from './types';

export interface PluginRecommendationCard extends RecommendationItem {
  kind: 'plugin';
  pluginId: string;
  /** CTA label when the app is already enabled but not receiving data yet. */
  setupAction: string;
  /** CTA target into the app itself, for the enabled-but-no-data state. */
  appHref: string;
}

/** Guided-connection card: never "enabled-but-silent", so no setup variant. */
interface ConnectionRecommendationCard extends RecommendationItem {
  kind: 'connection';
}

export type RecommendationCardDefinition = PluginRecommendationCard | ConnectionRecommendationCard;

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
  const connectionHref = locationUtil.assureBaseUrl(CONNECTIONS_ROUTES.AddNewConnection);
  return {
    'hosted-traces': pluginCard({
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
      href: connectionHref,
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
      href: connectionHref,
    },
  };
}

// Bypass getLocalPlugins(): it drops hidden plugins, which must still be classified here.
export async function fetchInstalledPlugins(): Promise<LocalPlugin[]> {
  return getBackendSrv().get('/api/plugins', accessControlQueryParam({ embedded: 0 }));
}
