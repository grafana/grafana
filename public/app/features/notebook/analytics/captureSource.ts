import { config, locationService } from '@grafana/runtime';

import { NOTEBOOK_ENTRY_POINT, type NotebookEntryPoint } from './types';

const SOURCE_APPS = {
  'grafana-agento11y-app': 'agent_o11y',
  'grafana-app-observability-app': 'app_o11y',
  'grafana-lokiexplore-app': 'logs_drilldown',
  'grafana-metricsdrilldown-app': 'metrics_drilldown',
  'grafana-exploretraces-app': 'traces_drilldown',
  'grafana-pyroscope-app': 'profiles_drilldown',
  'k6-app': 'k6',
  'grafana-irm-app': 'irm',
  'grafana-slo-app': 'slo',
  'grafana-synthetic-monitoring-app': 'synthetic_monitoring',
  'grafana-k8s-app': 'kubernetes',
  'grafana-dbo11y-app': 'database_o11y',
  'grafana-csp-app': 'cloud_provider_o11y',
  'grafana-kowalski-app': 'frontend_o11y',
} as const;

export type NotebookSourceApp = (typeof SOURCE_APPS)[keyof typeof SOURCE_APPS] | 'other_plugin';

export function readNotebookSourceApp(entryPoint: NotebookEntryPoint): NotebookSourceApp | undefined {
  if (entryPoint !== NOTEBOOK_ENTRY_POINT.PLUGIN) {
    return undefined;
  }
  const pathname = locationService.getLocation().pathname;
  const appPath =
    config.appSubUrl && pathname.startsWith(`${config.appSubUrl}/`)
      ? pathname.slice(config.appSubUrl.length)
      : pathname;
  const pluginId = appPath.match(/^\/a\/([^/]+)(?:\/|$)/)?.[1];
  return Object.entries(SOURCE_APPS).find(([id]) => id === pluginId)?.[1] ?? 'other_plugin';
}
