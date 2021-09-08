import {
  AbsoluteTimeRange,
  DataFrame,
  DataSourceApi,
  EventBusExtended,
  ExploreUrlState,
  FieldCache,
  FieldConfig,
  FieldType,
  getDefaultTimeRange,
  getLogLevelFromKey,
  HistoryItem,
  Labels,
  LoadingState,
  LogLevel,
  MutableDataFrame,
  PanelData,
} from '@grafana/data';

import { ExploreItemState } from 'app/types/explore';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import store from '../../../core/store';
import { clearQueryKeys, lastUsedDatasourceKeyForOrgId } from '../../../core/utils/explore';
import { toRawTimeRange } from '../utils/time';

export const DEFAULT_RANGE = {
  from: 'now-6h',
  to: 'now',
};

/**
 * Returns a fresh Explore area state
 */
export const makeExplorePaneState = (): ExploreItemState => ({
  containerWidth: 0,
  datasourceInstance: null,
  datasourceMissing: false,
  history: [],
  queries: [],
  initialized: false,
  range: {
    from: null,
    to: null,
    raw: DEFAULT_RANGE,
  } as any,
  absoluteRange: {
    from: null,
    to: null,
  } as any,
  scanning: false,
  loading: false,
  queryKeys: [],
  latency: 0,
  isLive: false,
  isPaused: false,
  queryResponse: createEmptyQueryResponse(),
  tableResult: null,
  graphResult: null,
  logsResult: null,
  eventBridge: (null as unknown) as EventBusExtended,
  cache: [],
  logsVolumeLoadingInProgress: false,
  autoLoadLogsVolume: false,
});

export const createEmptyQueryResponse = (): PanelData => ({
  state: LoadingState.NotStarted,
  series: [],
  timeRange: getDefaultTimeRange(),
});

export async function loadAndInitDatasource(
  orgId: number,
  datasourceName?: string
): Promise<{ history: HistoryItem[]; instance: DataSourceApi }> {
  let instance;
  try {
    instance = await getDatasourceSrv().get(datasourceName);
  } catch (error) {
    // Falling back to the default data source in case the provided data source was not found.
    // It may happen if last used data source or the data source provided in the URL has been
    // removed or it is not provisioned anymore.
    instance = await getDatasourceSrv().get();
  }
  if (instance.init) {
    try {
      instance.init();
    } catch (err) {
      // TODO: should probably be handled better
      console.error(err);
    }
  }

  const historyKey = `grafana.explore.history.${instance.meta?.id}`;
  const history = store.getObject(historyKey, []);
  // Save last-used datasource

  store.set(lastUsedDatasourceKeyForOrgId(orgId), instance.uid);
  return { history, instance };
}

export function getUrlStateFromPaneState(pane: ExploreItemState): ExploreUrlState {
  return {
    // datasourceInstance should not be undefined anymore here but in case there is some path for it to be undefined
    // lets just fallback instead of crashing.
    datasource: pane.datasourceInstance?.name || '',
    queries: pane.queries.map(clearQueryKeys),
    range: toRawTimeRange(pane.range),
  };
}

export function createCacheKey(absRange: AbsoluteTimeRange) {
  const params = {
    from: absRange.from,
    to: absRange.to,
  };

  const cacheKey = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v.toString())}`)
    .join('&');
  return cacheKey;
}

export function getResultsFromCache(
  cache: Array<{ key: string; value: PanelData }>,
  absoluteRange: AbsoluteTimeRange
): PanelData | undefined {
  const cacheKey = createCacheKey(absoluteRange);
  const cacheIdx = cache.findIndex((c) => c.key === cacheKey);
  const cacheValue = cacheIdx >= 0 ? cache[cacheIdx].value : undefined;
  return cacheValue;
}

export function getLogLevelFromLabels(labels: Labels): LogLevel {
  const labelNames = ['level', 'lvl', 'loglevel'];
  let levelLabel;
  for (let labelName of labelNames) {
    if (labelName in labels) {
      levelLabel = labelName;
      break;
    }
  }
  return levelLabel ? getLogLevelFromKey(labels[levelLabel]) : LogLevel.unknown;
}

export function aggregateFields(dataFrames: DataFrame[], config: FieldConfig): DataFrame {
  const aggregatedDataFrame = new MutableDataFrame();
  if (!dataFrames.length) {
    return aggregatedDataFrame;
  }

  const totalLength = dataFrames[0].length;
  const timeField = new FieldCache(dataFrames[0]).getFirstFieldOfType(FieldType.time);

  if (!timeField) {
    return aggregatedDataFrame;
  }

  aggregatedDataFrame.addField({ name: 'Time', type: FieldType.time }, totalLength);
  aggregatedDataFrame.addField({ name: 'Value', type: FieldType.number, config }, totalLength);

  dataFrames.forEach((dataFrame) => {
    dataFrame.fields.forEach((field) => {
      if (field.type === FieldType.number) {
        for (let pointIndex = 0; pointIndex < totalLength; pointIndex++) {
          const currentValue = aggregatedDataFrame.get(pointIndex).Value;
          const valueToAdd = field.values.get(pointIndex);
          const totalValue =
            currentValue === null && valueToAdd === null ? null : (currentValue || 0) + (valueToAdd || 0);
          aggregatedDataFrame.set(pointIndex, { Value: totalValue, Time: timeField.values.get(pointIndex) });
        }
      }
    });
  });

  return aggregatedDataFrame;
}
