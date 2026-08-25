import { type LoadingState } from '@grafana/data';
import { SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

export interface QueryPreview {
  dispose(): void;
  subscribeToState(listener: (state: LoadingState) => void): VoidFunction;
}

function getPanelQueryRunner(panel: VizPanel): SceneQueryRunner | undefined {
  const dataProvider = panel.state.$data;
  if (dataProvider instanceof SceneQueryRunner) {
    return dataProvider;
  }
  if (dataProvider instanceof SceneDataTransformer && dataProvider.state.$data instanceof SceneQueryRunner) {
    return dataProvider.state.$data;
  }
  return undefined;
}

export function startQueryPreview(
  panel: VizPanel,
  originalRefId: string,
  proposedQuery: DataQuery
): QueryPreview | undefined {
  const queryRunner = getPanelQueryRunner(panel);
  if (!queryRunner || !queryRunner.state.queries.some((query) => query.refId === originalRefId)) {
    return undefined;
  }

  const baselineData = queryRunner.state.data;
  const previewRunner = queryRunner.clone({
    key: undefined,
    queries: queryRunner.state.queries.map((query) =>
      query.refId === originalRefId ? { ...proposedQuery, refId: originalRefId } : query
    ),
    data: undefined,
    _hasFetchedData: false,
    runQueriesMode: 'manual',
  });
  let disposed = false;
  const stateListeners = new Set<(state: LoadingState) => void>();
  const subscription = previewRunner.subscribeToState((state, previousState) => {
    if (state.data !== previousState.data && state.data) {
      queryRunner.setState({ data: state.data });
      stateListeners.forEach((listener) => listener(state.data!.state));
    }
  });

  queryRunner.cancelQuery();
  panel.setState({ $behaviors: [...(panel.state.$behaviors ?? []), previewRunner] });
  previewRunner.runQueries();

  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      stateListeners.clear();
      subscription.unsubscribe();
      previewRunner.cancelQuery();
      queryRunner.setState({ data: baselineData });
      panel.setState({ $behaviors: panel.state.$behaviors?.filter((behavior) => behavior !== previewRunner) });
      previewRunner.clearParent();
    },
    subscribeToState: (listener) => {
      stateListeners.add(listener);
      const currentState = previewRunner.state.data?.state;
      if (currentState !== undefined) {
        listener(currentState);
      }
      return () => stateListeners.delete(listener);
    },
  };
}
