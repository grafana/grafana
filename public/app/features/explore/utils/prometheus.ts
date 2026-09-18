import { matchPluginId } from '@grafana/data';

/**
 * Whether a datasource is Prometheus or one of its managed flavors, such as
 * `grafana-amazonprometheus-datasource`, where only a type id is available - for example
 * on a query's datasource ref in a Mixed pane. With full plugin meta in hand, call
 * `matchPluginId` directly instead.
 *
 * `matchPluginId` resolves Prometheus flavors from the id alone and never consults
 * `aliasIDs` for this particular match, so a bare `{ id }` gives the same answer as full
 * plugin meta. That equivalence is an implementation detail of `matchPluginId` rather than
 * a guarantee, so `prometheus.test.ts` pins it: a caller holding only a type must not
 * silently disagree with one holding meta.
 */
export function isPrometheusType(type: string | undefined | null): boolean {
  return !!type && matchPluginId('prometheus', { id: type });
}
