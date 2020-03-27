import { ExploreId, ExploreItemState, ExploreState, RichHistoryQuery } from 'app/types/explore';
import { makeExploreItemState } from 'app/features/explore/state/reducers';
import { StoreState, UserState } from 'app/types';
import { TimeRange, dateTime, DataSourceApi } from '@grafana/data';

export const mockExploreState = (options: any = {}) => {
  const isLive = options.isLive || false;
  const history: any[] = [];
  const eventBridge = {
    emit: jest.fn(),
  };
  const streaming = options.streaming || undefined;
  const datasourceInterval = options.datasourceInterval || '';
  const refreshInterval = options.refreshInterval || '';
  const containerWidth = options.containerWidth || 1980;
  const queries = options.queries || [];
  const datasourceError = options.datasourceError || null;
  const scanner = options.scanner || jest.fn();
  const scanning = options.scanning || false;
  const datasourceId = options.datasourceId || '1337';
  const exploreId = ExploreId.left;
  const datasourceInstance: DataSourceApi<any> = options.datasourceInstance || {
    id: 1337,
    query: jest.fn(),
    name: 'test',
    testDatasource: jest.fn(),
    meta: {
      id: datasourceId,
      streaming,
    },
    interval: datasourceInterval,
  };
  const range: TimeRange = options.range || {
    from: dateTime('2019-01-01 10:00:00.000Z'),
    to: dateTime('2019-01-01 16:00:00.000Z'),
    raw: {
      from: 'now-6h',
      to: 'now',
    },
  };
  const urlReplaced = options.urlReplaced || false;
  const left: ExploreItemState = options.left || {
    ...makeExploreItemState(),
    containerWidth,
    datasourceError,
    datasourceInstance,
    eventBridge,
    history,
    isLive,
    queries,
    refreshInterval,
    scanner,
    scanning,
    urlReplaced,
    range,
  };
  const right: ExploreItemState = options.right || {
    ...makeExploreItemState(),
    containerWidth,
    datasourceError,
    datasourceInstance,
    eventBridge,
    history,
    isLive,
    queries,
    refreshInterval,
    scanner,
    scanning,
    urlReplaced,
    range,
  };
  const split: boolean = options.split || false;
  const syncedTimes: boolean = options.syncedTimes || false;
  const richHistory: RichHistoryQuery[] = [];
  const explore: ExploreState = {
    left,
    right,
    syncedTimes,
    split,
    richHistory,
  };

  const user: UserState = {
    orgId: 1,
    timeZone: 'browser',
  };

  const state: Partial<StoreState> = {
    explore,
    user,
  };

  return {
    containerWidth,
    datasourceId,
    datasourceInstance,
    datasourceInterval,
    eventBridge,
    exploreId,
    history,
    queries,
    refreshInterval,
    state,
    scanner,
    range,
  };
};
