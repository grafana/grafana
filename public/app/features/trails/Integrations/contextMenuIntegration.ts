import { RawTimeRange } from '@grafana/data';
import { SceneTimeRange } from '@grafana/scenes';
import { MenuItemProps } from '@grafana/ui';

import { DataTrailEmbedded, DataTrailEmbeddedState } from './DataTrailEmbedded';
import { launchSceneDrawerInGlobalModal } from './SceneDrawer';
import { getQueryMetrics } from './getQueryMetrics';
import { createAdHocFilters, getQueryMetricLabel } from './utils';

export function getContextMenuItems<T>(
  query: string,
  rawTimeRange: RawTimeRange,
  prometheusDataSourceUid: string
): Array<MenuItemProps<T>> {
  const queryMetrics = getQueryMetrics([query]);

  const timeRange = new SceneTimeRange({
    from: rawTimeRange.from.toString(),
    to: rawTimeRange.to.toString(),
  });

  return queryMetrics.map((queryMetric) => {
    const label = `Explore ${getQueryMetricLabel(queryMetric)}`;

    const item: MenuItemProps<T> = {
      label,
      ariaLabel: label,
      icon: 'code-branch',
      onClick: () => {
        const state: DataTrailEmbeddedState = {
          metric: queryMetric.metric,
          filters: createAdHocFilters(queryMetric.labelFilters),
          dataSourceUid: prometheusDataSourceUid,
          timeRange,
        };

        const scene = new DataTrailEmbedded(state);
        launchSceneDrawerInGlobalModal({ scene, title: 'Explore metrics' });
      },
    };

    return item;
  });
}
