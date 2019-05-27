import { DataSourceApi } from '@grafana/ui/src/types/datasource';

import { ExploreId, ExploreItemState, ExploreState } from 'app/types/explore';
import { makeExploreItemState } from 'app/features/explore/state/reducers';
import { StoreState } from 'app/types';

export const mockExploreState = (options: any = {}) => {
  const isLive = options.isLive || false;
  const history = [];
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
  };
  const split: boolean = options.split || false;
  const explore: ExploreState = {
    left,
    right,
    split,
  };
  const state: Partial<StoreState> = {
    explore,
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
  };
};
