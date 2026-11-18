import { type MouseEvent } from 'react';

import { getDefaultTimeRange, locationUtil, type LogRowModel, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { type GetRowContextQueryFn } from 'app/features/logs/components/panel/LogLineMenu';

/**
 * Gets the base URL before the /explore path.
 * Used for constructing explore URLs with permalinks.
 *
 * @returns The base URL (e.g., "http://localhost:3000" or "https://grafana.com")
 */
export function getExploreBaseUrl(): string {
  const match = /.*(?=\/explore)/.exec(window.location.href);
  return match ? match[0] : window.location.origin;
}

export async function handleOpenLogsContextClick(
  event: MouseEvent<HTMLElement>,
  row: LogRowModel,
  getRowContextQuery: GetRowContextQueryFn | undefined,
  onOpenContext: (row: LogRowModel) => void
) {
  // if ctrl or meta key is pressed, open query in new Explore tab
  if (getRowContextQuery && (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey || event.nativeEvent.shiftKey)) {
    const win = window.open('about:blank');
    // for this request we don't want to use the cached filters from a context provider, but always want to refetch and clear
    const query = await getRowContextQuery(row, undefined, false);
    if (query && win) {
      const url = urlUtil.renderUrl(locationUtil.assureBaseUrl(`${config.appSubUrl}explore`), {
        left: JSON.stringify({
          datasource: query.datasource,
          queries: [query],
          range: getDefaultTimeRange(),
        }),
      });
      win.location = url;

      return;
    }
    win?.close();
  }
  onOpenContext(row);
}
