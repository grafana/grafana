/**
 * Dashboard Data API -- the object exposed to plugins via RestrictedGrafanaApis.
 *
 * The implementation needs layout classes from the lazily loaded dashboard chunk, and this module is part of the
 * main bundle, so a dashboard page provides it when its module loads. Until then the API reports that no dashboard
 * is open. A leaf module on purpose: dashboard code imports it without creating a cycle.
 */

import type { DashboardDataAPI } from '@grafana/data';

let implementation: DashboardDataAPI | undefined;

export function provideDashboardDataApi(instance: DashboardDataAPI): void {
  implementation ??= instance;
}

export const dashboardDataApi: DashboardDataAPI = {
  getDashboard: () => implementation?.getDashboard(),
  getPanels: () => implementation?.getPanels() ?? [],
  getVariables: () => implementation?.getVariables() ?? [],
  resolveSources: (refs) =>
    implementation?.resolveSources(refs) ?? { panelKeys: [], unavailable: refs.map((ref) => ({ ref })) },
  capturePanels: (request) =>
    implementation?.capturePanels(request) ?? Promise.reject(new Error('No dashboard is open.')),
  revealPanel: (panelKey) => implementation?.revealPanel(panelKey),
  getExploreUrl: (panelKey, timeWindow) =>
    implementation?.getExploreUrl(panelKey, timeWindow) ?? Promise.resolve(undefined),
  subscribe: (listener) => implementation?.subscribe(listener) ?? (() => {}),
};
