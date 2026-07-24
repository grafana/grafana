import { type ReactElement, useCallback, useMemo } from 'react';

import {
  PluginExtensionPoints,
  type RawTimeRange,
  getDefaultTimeRange,
  getTimeZone,
  locationUtil,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { type DataQuery, type TimeZone } from '@grafana/schema';
import { Button } from '@grafana/ui';

type Props = {
  queries: DataQuery[];
  onExtensionClick?: () => void;
  compact?: boolean;
};

const QUERYLESS_APPS = [
  'grafana-pyroscope-app',
  'grafana-lokiexplore-app',
  'grafana-exploretraces-app',
  'grafana-metricsdrilldown-app',
];

/**
 * Renders a button to open queryless drilldown apps.
 * Only displays when at least one queryless app extension is available.
 */
/**
 * Exposes the queryless-app drilldown availability + click behavior so it can be rendered in different
 * shapes (a button, a menu item, etc.). Returns `isAvailable: false` when no queryless app extension is
 * registered for the given queries.
 */
export function useDrilldownExtension(
  queries: DataQuery[],
  onExtensionClick?: () => void
): { isAvailable: boolean; onClick: () => void } {
  const context = useExtensionPointContext(queries);
  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
    context: context,
  });
  const querylessLinks = useMemo(() => links.filter((link) => QUERYLESS_APPS.includes(link.pluginId)), [links]);

  const onClick = useCallback(() => {
    onExtensionClick?.();
    const firstLink = querylessLinks[0];
    if (!firstLink?.path) {
      return;
    }
    global.open(locationUtil.assureBaseUrl(firstLink.path), '_blank');
  }, [querylessLinks, onExtensionClick]);

  return { isAvailable: querylessLinks.length > 0, onClick };
}

export function DrilldownExtensionPoint({ queries, onExtensionClick, compact }: Props): ReactElement | null {
  const { isAvailable, onClick } = useDrilldownExtension(queries, onExtensionClick);

  if (!isAvailable) {
    return null;
  }

  return (
    <Button variant="secondary" size={compact ? 'sm' : 'md'} type="button" onClick={onClick}>
      <Trans i18nKey="explore.queryless-apps-extensions.drilldown">Drilldown</Trans>
    </Button>
  );
}

type PluginExtensionExploreContext = {
  targets: DataQuery[];
  timeRange: RawTimeRange;
  timeZone: TimeZone;
};

function useExtensionPointContext(queries: DataQuery[]): PluginExtensionExploreContext {
  return useMemo(() => {
    const range = getDefaultTimeRange();
    return {
      targets: queries,
      timeRange: range.raw,
      timeZone: getTimeZone(),
    };
  }, [queries]);
}
