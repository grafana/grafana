import { ReactElement, useCallback, useMemo } from 'react';

import { PluginExtensionPoints, RawTimeRange, getDefaultTimeRange, getTimeZone, locationUtil } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Button } from '@grafana/ui';

type Props = {
  queries: DataQuery[];
  onExtensionClick?: () => void;
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
export function DrilldownExtensionPoint(props: Props): ReactElement | null {
  const { onExtensionClick } = props;
  const context = useExtensionPointContext(props);
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

  if (!querylessLinks.length) {
    return null;
  }

  return (
    <Button variant="secondary" onClick={onClick}>
      <Trans i18nKey="explore.queryless-apps-extensions.drilldown">Drilldown</Trans>
    </Button>
  );
}

export type PluginExtensionExploreContext = {
  targets: DataQuery[];
  timeRange: RawTimeRange;
  timeZone: TimeZone;
};

function useExtensionPointContext({ queries }: Props): PluginExtensionExploreContext {
  return useMemo(() => {
    const range = getDefaultTimeRange();
    return {
      targets: queries,
      timeRange: range.raw,
      timeZone: getTimeZone(),
    };
  }, [queries]);
}
