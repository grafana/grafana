import { config } from '@grafana/runtime';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

const MOST_USED_SORT = '-views_last_30_days';

/** Enterprise analytics license is required to sort by view counts. */
export function isMostUsedAvailable() {
  return Boolean(config.licenseInfo.enabledFeatures?.analytics);
}

export async function getMostUsedDashboards(maxItems: number) {
  if (!isMostUsedAvailable()) {
    return [];
  }
  const response = await getGrafanaSearcher().search({
    kind: ['dashboard'],
    sort: MOST_USED_SORT,
    limit: maxItems,
  });
  return response.view.toArray();
}
