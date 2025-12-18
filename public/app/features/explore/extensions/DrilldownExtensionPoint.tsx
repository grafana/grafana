import { ReactElement, useCallback, useMemo } from 'react';

import { PluginExtensionPoints, RawTimeRange, getDefaultTimeRange, getTimeZone, locationUtil } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Button } from '@grafana/ui';

type Props = {
  queries: DataQuery[];
};

const QUERYLESS_APPS = [
  'grafana-pyroscope-app',
  'grafana-lokiexplore-app',
  'grafana-exploretraces-app',
  'grafana-metricsdrilldown-app',
];

export function DrilldownExtensionPoint(props: Props): ReactElement | null {
  const context = useExtensionPointContext(props);
  // TODO: Pull it up to avoid calling it twice
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

  return (
    <Button variant="secondary" onClick={onClick}>
      {querylessLinks[0].title}
    </Button>
  );
}

export type PluginExtensionExploreContext = {
  targets: DataQuery[];
  timeRange: RawTimeRange;
  timeZone: TimeZone;
};

function useExtensionPointContext({ queries }: Props): PluginExtensionExploreContext {
  const range = getDefaultTimeRange();

  return useMemo(() => {
    return {
      targets: queries,
      timeRange: range.raw,
      timeZone: getTimeZone(),
    };
  }, [queries, range.raw]);
}
