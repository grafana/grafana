import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { type QueryGroupOptions } from 'app/types/query';

import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
import { type QueryOptionName } from '../utils/interactions';
import { trackPanelSettingChange } from '../utils/trackPanelSettingChange';

/**
 * The query options a change sets differently from the panel's current state, compared the way both data panes
 * apply them. Must run before the change is applied.
 */
export function getChangedQueryOptions(
  panel: VizPanel,
  queryRunner: SceneQueryRunner,
  options: QueryGroupOptions
): QueryOptionName[] {
  const timeRange = panel.state.$timeRange instanceof PanelTimeRange ? panel.state.$timeRange.state : undefined;
  const changed: Array<[QueryOptionName, unknown, unknown]> = [
    ['max_data_points', options.maxDataPoints, queryRunner.state.maxDataPoints],
    ['min_interval', options.minInterval, queryRunner.state.minInterval],
    ['cache_timeout', options.cacheTimeout, queryRunner.state.cacheTimeout],
    ['query_caching_ttl', options.queryCachingTTL, queryRunner.state.queryCachingTTL],
    ['relative_time', options.timeRange?.from, timeRange?.timeFrom],
    ['time_shift', options.timeRange?.shift, timeRange?.timeShift],
    ['hide_time_info', options.timeRange?.hide, timeRange?.hideTimeOverride],
  ];

  // null, undefined and an empty field all mean "not set".
  const normalize = (value: unknown) => (value === null || value === '' || value === false ? undefined : value);

  return changed.filter(([, next, current]) => normalize(next) !== normalize(current)).map(([name]) => name);
}

export function trackQueryOptionChanges(panel: VizPanel, changed: QueryOptionName[], editor: 'classic' | 'next') {
  for (const option of changed) {
    trackPanelSettingChange(panel, 'change_query_option', 'panel_editor', { option, editor });
  }
}
