import { useCallback, useMemo } from 'react';

import { PluginExtensionPoints, RawTimeRange, getDefaultTimeRange, getTimeZone, locationUtil } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';

const QUERYLESS_APPS = [
  'grafana-pyroscope-app',
  'grafana-lokiexplore-app',
  'grafana-exploretraces-app',
  'grafana-metricsdrilldown-app',
];

export type PluginExtensionExploreContext = {
  targets: DataQuery[];
  timeRange: RawTimeRange;
  timeZone: TimeZone;
};

/**
 * Creates the extension point context for drilldown actions.
 * @param queries - The data queries to include in the context
 * @returns The extension point context
 */
export function createExtensionPointContext(queries: DataQuery[]): PluginExtensionExploreContext {
  const range = getDefaultTimeRange();
  return {
    targets: queries,
    timeRange: range.raw,
    timeZone: getTimeZone(),
  };
}

/**
 * Hook that returns queryless drilldown links and handlers.
 * @param queries - The data queries to use for the extension point context
 * @returns An object containing the queryless links and an onClick handler, or null if no links are available
 */
export function useDrilldownExtensionPoint(queries: DataQuery[]) {
  const context = useMemo(() => createExtensionPointContext(queries), [queries]);
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    context: context,
    limitPerPlugin: 3,
  });
  const querylessLinks = useMemo(() => links.filter((link) => QUERYLESS_APPS.includes(link.pluginId)), [links]);

  const onClick = useCallback(() => {
    if (!querylessLinks.length || !querylessLinks[0].path) {
      return;
    }
    global.open(locationUtil.assureBaseUrl(querylessLinks[0].path), '_blank');
  }, [querylessLinks]);

  if (!querylessLinks.length) {
    return null;
  }

  return {
    links: querylessLinks,
    onClick,
    primaryLink: querylessLinks[0],
  };
}
