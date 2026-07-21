import { locationUtil, urlUtil } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { generateExploreId } from 'app/core/utils/explore';

/**
 * Synchronous Explore href for variable-free queries. getExploreUrl is async and loads datasource
 * plugins for variable interpolation — a homepage card must not do that, so this mirrors its
 * pane-state shape directly.
 */
export function buildExploreHref(
  datasourceUid: string,
  queries: DataQuery[],
  range: { from: string; to: string }
): string {
  const panes = JSON.stringify({
    [generateExploreId()]: { datasource: datasourceUid, queries, range },
  });
  return locationUtil.assureBaseUrl(urlUtil.renderUrl('/explore', { schemaVersion: 1, panes }));
}
