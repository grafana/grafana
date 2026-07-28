import { matchPluginId, type PluginMeta } from '@grafana/data';

/**
 * Whether a datasource plugin is Prometheus or one of its managed flavors, such as
 * `grafana-amazonprometheus-datasource`.
 */
export function isPrometheusPlugin(pluginMeta: Pick<PluginMeta, 'id' | 'aliasIDs'>): boolean {
  return matchPluginId('prometheus', pluginMeta);
}

/**
 * The same check where only a type id is available, such as on a query's datasource
 * ref in a Mixed pane.
 *
 * `matchPluginId` resolves Prometheus flavors from the id alone and never consults
 * `aliasIDs` for this particular match, so a bare `{ id }` gives the same answer as
 * full plugin meta. That equivalence is an implementation detail of `matchPluginId`
 * rather than a guarantee, which is why both callers share these helpers instead of
 * open-coding the check and risking a silent divergence.
 */
export function isPrometheusType(type: string | undefined | null): boolean {
  return !!type && isPrometheusPlugin({ id: type });
}
