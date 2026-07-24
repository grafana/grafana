import { getBackendSrv } from '@grafana/runtime';

import { FRONTEND_OBSERVABILITY_APP_ID } from './appPluginIds';

// App plugin route proxy (plugin.json `routes`); one module owns the URL so callers never
// hardcode plugin paths.
const pluginProxyUrl = (pluginId: string, path: string) => `/api/plugin-proxy/${pluginId}${path}`;

/**
 * Apps registered in the Frontend Observability (Faro) app. A non-array response reads as empty
 * so an API shape change degrades toward showing the recommendation, never toward hiding it.
 */
export async function fetchFaroApps(): Promise<unknown[]> {
  const response = await getBackendSrv().get<unknown>(
    pluginProxyUrl(FRONTEND_OBSERVABILITY_APP_ID, '/api-proxy/api/v1/app'),
    undefined,
    undefined,
    // Probe failures are expected and handled by the caller; never toast them.
    { showErrorAlert: false }
  );
  return Array.isArray(response) ? response : [];
}
