import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';

import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
import { type QueryOptionName } from '../utils/interactions';
import { trackPanelSettingChange } from '../utils/trackPanelSettingChange';

type QueryOptionState = Record<QueryOptionName, unknown>;

/**
 * The query options as the panel holds them. Read it before and after a change is applied: comparing the two
 * reports only what was kept, since the data panes drop some values (for example a hide time info setting with
 * no relative time or time shift to apply it to).
 */
export function getQueryOptionState(panel: VizPanel, queryRunner: SceneQueryRunner): QueryOptionState {
  const timeRange = panel.state.$timeRange instanceof PanelTimeRange ? panel.state.$timeRange.state : undefined;

  return {
    max_data_points: queryRunner.state.maxDataPoints,
    min_interval: queryRunner.state.minInterval,
    cache_timeout: queryRunner.state.cacheTimeout,
    query_caching_ttl: queryRunner.state.queryCachingTTL,
    relative_time: timeRange?.timeFrom,
    time_shift: timeRange?.timeShift,
    hide_time_info: timeRange?.hideTimeOverride,
  };
}

export function getChangedQueryOptions(before: QueryOptionState, after: QueryOptionState): QueryOptionName[] {
  // null, an empty value and false all mean "not set", for example hide time info on a newly created time range.
  const normalize = (value: unknown) => (value === null || value === '' || value === false ? undefined : value);

  const names: QueryOptionName[] = [
    'max_data_points',
    'min_interval',
    'cache_timeout',
    'query_caching_ttl',
    'relative_time',
    'time_shift',
    'hide_time_info',
  ];
  return names.filter((name) => normalize(before[name]) !== normalize(after[name]));
}

export function trackQueryOptionChanges(panel: VizPanel, changed: QueryOptionName[], editor: 'classic' | 'next') {
  for (const option of changed) {
    trackPanelSettingChange(panel, 'change_query_option', 'panel_editor', { option, editor });
  }
}
