import { isEqual } from 'lodash';

import { LoadingState, type PanelData } from '@grafana/data';
import { sceneGraph, type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { getQueryRunnerFor } from '../../../../utils/getQueryRunnerFor';

export interface QueryPreviewSelection {
  debounce?: boolean;
}

export interface QueryPreview {
  readonly data?: PanelData;
  select(query: DataQuery, options?: QueryPreviewSelection): boolean;
  dispose(): void;
  subscribeToState(listener: (state: LoadingState) => void): VoidFunction;
  subscribeToData(listener: (data: PanelData | undefined) => void): VoidFunction;
}

interface PreviewRun {
  runner: SceneQueryRunner;
  unsubscribe: VoidFunction;
}

const KEYBOARD_PREVIEW_DELAY_MS = 150;

export function startQueryPreview(
  panel: VizPanel,
  originalRefId: string,
  proposedQuery: DataQuery
): QueryPreview | undefined {
  const queryRunner = getQueryRunnerFor(panel);
  const baselineQuery = queryRunner?.state.queries.find((query) => query.refId === originalRefId);
  if (!queryRunner || !baselineQuery) {
    return undefined;
  }

  const baselineQueries = queryRunner.state.queries;
  const baselineData = queryRunner.state.data;
  const readRangeKey = () => {
    const range = sceneGraph.getTimeRange(panel).state.value;
    return range.from.valueOf() + ':' + range.to.valueOf();
  };
  let rangeKey = readRangeKey();
  const cache = new Map<string, PanelData>();
  if (baselineData && baselineData.state !== LoadingState.Loading && baselineData.state !== LoadingState.Streaming) {
    cache.set('original', baselineData);
  }
  const runs = new Map<string, PreviewRun>();
  const stateListeners = new Set<(state: LoadingState) => void>();
  const dataListeners = new Set<(data: PanelData | undefined) => void>();
  let activeRun: PreviewRun | undefined;
  let cancellingRun: PreviewRun | undefined;
  let selectedKey: string | undefined;
  let latestData: PanelData | undefined;
  let lastProjectedData: PanelData | undefined;
  let pendingStart: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let canonicalSubscription: ReturnType<typeof queryRunner.subscribeToState> | undefined;

  const publish = (data: PanelData | undefined) => {
    latestData = data;
    dataListeners.forEach((listener) => listener(data));
    stateListeners.forEach((listener) => listener(data?.state ?? LoadingState.Loading));
  };
  const project = (data: PanelData) => {
    // Clone runners emit an empty Loading frame before their first result.
    if (data.state === LoadingState.Loading && data.series.length === 0 && queryRunner.state.data) {
      return;
    }
    lastProjectedData = data;
    queryRunner.setState({ data });
  };
  const clearPendingStart = () => {
    if (pendingStart !== undefined) {
      clearTimeout(pendingStart);
      pendingStart = undefined;
    }
  };
  const detach = (run: PreviewRun) => {
    if (activeRun === run) {
      activeRun = undefined;
    }
    if (run.runner.parent !== panel) {
      return;
    }
    // cancelQuery itself emits Done; that frame is not a completed response to cache.
    cancellingRun = run;
    try {
      run.runner.cancelQuery();
    } finally {
      cancellingRun = undefined;
    }
    // cancelQuery cannot cancel datasource resolution that has not created a subscription yet.
    run.runner.setState({ queries: [] });
    panel.setState({ $behaviors: panel.state.$behaviors?.filter((behavior) => behavior !== run.runner) });
    run.runner.clearParent();
  };
  const clearRuns = () => {
    runs.forEach((run) => {
      run.unsubscribe();
      detach(run);
    });
    runs.clear();
  };
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    clearPendingStart();
    stateListeners.clear();
    dataListeners.clear();
    canonicalSubscription?.unsubscribe();
    clearRuns();
    if (queryRunner.state.data === lastProjectedData) {
      queryRunner.setState({ data: baselineData });
    }
  };

  const select = (query: DataQuery, options?: QueryPreviewSelection): boolean => {
    if (disposed || query.refId !== originalRefId) {
      return false;
    }
    const nextRangeKey = readRangeKey();
    if (nextRangeKey !== rangeKey) {
      clearPendingStart();
      clearRuns();
      cache.clear();
      selectedKey = undefined;
      rangeKey = nextRangeKey;
    }
    const key = isEqual(query, baselineQuery) ? 'original' : JSON.stringify(query);
    if (selectedKey === key && (activeRun || pendingStart !== undefined)) {
      return true;
    }
    clearPendingStart();
    if (activeRun) {
      detach(activeRun);
    }
    selectedKey = key;
    const cached = cache.get(key);
    if (cached) {
      project(cached);
      publish(cached);
      return true;
    }
    publish(undefined);
    const start = () => {
      pendingStart = undefined;
      if (disposed || selectedKey !== key || readRangeKey() !== nextRangeKey) {
        return;
      }
      const previousRun = runs.get(key);
      if (previousRun) {
        previousRun.unsubscribe();
        detach(previousRun);
      }
      const runner = queryRunner.clone({
        key: undefined,
        queries: baselineQueries.map((candidate) =>
          candidate.refId === originalRefId ? { ...query, refId: originalRefId } : candidate
        ),
        data: undefined,
        _hasFetchedData: false,
        runQueriesMode: 'manual',
      });
      const run: PreviewRun = { runner, unsubscribe: () => undefined };
      runs.set(key, run);
      activeRun = run;
      const subscription = runner.subscribeToState((state, previousState) => {
        const data = state.data;
        if (
          disposed ||
          cancellingRun === run ||
          runs.get(key) !== run ||
          state.data === previousState.data ||
          !data ||
          (activeRun !== run && data.request?.targets.length === 0) ||
          readRangeKey() !== nextRangeKey
        ) {
          return;
        }
        if (data.state === LoadingState.Done || data.state === LoadingState.Error) {
          cache.set(key, data);
        }
        if (activeRun === run && selectedKey === key) {
          project(data);
          publish(data);
        }
      });
      run.unsubscribe = () => subscription.unsubscribe();
      panel.setState({ $behaviors: [...(panel.state.$behaviors ?? []), runner] });
      runner.runQueries();
    };
    if (options?.debounce) {
      pendingStart = setTimeout(start, KEYBOARD_PREVIEW_DELAY_MS);
    } else {
      start();
    }
    return true;
  };

  canonicalSubscription = queryRunner.subscribeToState((state, previousState) => {
    if (state.queries !== previousState.queries && !isEqual(state.queries, baselineQueries)) {
      dispose();
    }
  });
  queryRunner.cancelQuery();
  if (baselineData) {
    project(baselineData);
  }
  select(proposedQuery);

  return {
    get data() {
      return latestData;
    },
    select,
    dispose,
    subscribeToState: (listener) => {
      stateListeners.add(listener);
      listener(latestData?.state ?? LoadingState.Loading);
      return () => stateListeners.delete(listener);
    },
    subscribeToData: (listener) => {
      dataListeners.add(listener);
      listener(latestData);
      return () => dataListeners.delete(listener);
    },
  };
}
