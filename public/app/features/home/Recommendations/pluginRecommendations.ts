import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { type LocalPlugin } from 'app/features/plugins/admin/types';

import {
  APP_OBSERVABILITY_APP_ID,
  FRONTEND_OBSERVABILITY_APP_ID,
  HOSTED_TRACES_APP_ID,
  SYNTHETIC_MONITORING_APP_ID,
} from './appPluginIds';
import { type RecommendationItem } from './types';

export interface PluginRecommendationItem extends RecommendationItem {
  pluginId: string;
  /** CTA label when the app is already enabled but not receiving data yet. */
  setupAction: string;
  /** CTA target into the app itself, for the enabled-but-no-data state. */
  appHref: string;
}

export function getRecommendations(): PluginRecommendationItem[] {
  const recommendationDefinitions: Array<Omit<PluginRecommendationItem, 'href' | 'appHref'>> = [
    {
      id: 'hosted-traces',
      pluginId: HOSTED_TRACES_APP_ID,
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
    },
    {
      id: 'synthetic-monitoring',
      pluginId: SYNTHETIC_MONITORING_APP_ID,
      icon: 'globe',
      color: (theme) => theme.visualization.getColorByName('purple'),
      title: t('home.recommendations.synthetic-monitoring.title', 'Watch your cluster from outside'),
      context: t('home.recommendations.synthetic-monitoring.context', 'Catch outages before your users do'),
      description: t(
        'home.recommendations.synthetic-monitoring.description',
        'Probe your endpoints from 20+ global locations before your users notice.'
      ),
      action: t('home.recommendations.synthetic-monitoring.action', 'Add Synthetic Monitoring'),
      setupAction: t('home.recommendations.synthetic-monitoring.setup-action', 'Set up Synthetic Monitoring'),
    },
    {
      id: 'application-observability',
      pluginId: APP_OBSERVABILITY_APP_ID,
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
    },
    {
      id: 'frontend-observability',
      pluginId: FRONTEND_OBSERVABILITY_APP_ID,
      icon: 'frontend-observability',
      color: (theme) => theme.visualization.getColorByName('blue'),
      title: t('home.recommendations.frontend-observability.title', 'Measure real user experience'),
      context: t('home.recommendations.frontend-observability.context', 'Connect the browser to your backend traces'),
      description: t(
        'home.recommendations.frontend-observability.description',
        'Capture Core Web Vitals and errors from the browser and tie them back to backend traces.'
      ),
      action: t('home.recommendations.frontend-observability.action', 'Enable Frontend Observability'),
      setupAction: t('home.recommendations.frontend-observability.setup-action', 'Set up Frontend Observability'),
    },
  ];

  return recommendationDefinitions.map((recommendation) => ({
    ...recommendation,
    href: locationUtil.assureBaseUrl(`/plugins/${recommendation.pluginId}/`),
    appHref: locationUtil.assureBaseUrl(createBridgeURL(recommendation.pluginId, '')),
  }));
}

// Bypass getLocalPlugins(): it drops hidden plugins, which must still be classified here.
export async function fetchInstalledPlugins(): Promise<LocalPlugin[]> {
  return getBackendSrv().get('/api/plugins', accessControlQueryParam({ embedded: 0 }));
}
