import { useMemo } from 'react';

import { DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { QueryGroupOptions } from 'app/types/query';

import { PanelTimeRange } from '../../../../scene/panel-timerange/PanelTimeRange';

interface UseQueryOptionsParams {
  panel: VizPanel;
  queryRunner: SceneQueryRunner | undefined;
  dsSettings: DataSourceInstanceSettings | undefined;
}

/**
 * Extracts time range values from panel's $timeRange object.
 */
function extractTimeRange(timeRangeObj: unknown): QueryGroupOptions['timeRange'] {
  if (!(timeRangeObj instanceof PanelTimeRange)) {
    return { from: undefined, shift: undefined, hide: undefined };
  }

  const { timeFrom, timeShift, hideTimeOverride } = timeRangeObj.state;
  return {
    from: timeFrom,
    shift: timeShift,
    hide: hideTimeOverride,
  };
}

/**
 * Custom hook to build QueryGroupOptions from Scene state with proper memoization.
 * Only recomputes when the actual option values change, not on every query run.
 */
export function useQueryOptions({ panel, queryRunner, dsSettings }: UseQueryOptionsParams): QueryGroupOptions {
  const panelState = panel.useState();
  const queryRunnerState = queryRunner?.useState();

  const queryOptions: QueryGroupOptions = useMemo(() => {
    const showCacheTimeout = dsSettings?.meta.queryOptions?.cacheTimeout;
    const showCacheTTL = dsSettings?.cachingConfig?.enabled;

    const dataSource = dsSettings
      ? { default: dsSettings.isDefault, ...getDataSourceRef(dsSettings) }
      : { default: undefined, type: undefined, uid: undefined };

    const timeRange = extractTimeRange(panelState.$timeRange);

    return {
      cacheTimeout: showCacheTimeout ? queryRunnerState?.cacheTimeout : undefined,
      queryCachingTTL: showCacheTTL ? queryRunnerState?.queryCachingTTL : undefined,
      dataSource,
      queries: [],
      maxDataPoints: queryRunnerState?.maxDataPoints,
      minInterval: queryRunnerState?.minInterval,
      timeRange,
    };
  }, [
    panelState.$timeRange,
    queryRunnerState?.maxDataPoints,
    queryRunnerState?.minInterval,
    queryRunnerState?.cacheTimeout,
    queryRunnerState?.queryCachingTTL,
    dsSettings,
  ]);

  return queryOptions;
}
