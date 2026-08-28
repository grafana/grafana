import { isEqual } from 'lodash';

import { type LoadingState } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { getQueryRunnerFor } from '../../../../utils/utils';

export interface QueryPreview {
  dispose(): void;
  subscribeToState(listener: (state: LoadingState) => void): VoidFunction;
}

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
  let canonicalQuerySubscription: ReturnType<typeof queryRunner.subscribeToState> | undefined;
  const subscription = previewRunner.subscribeToState((state, previousState) => {
    if (state.data !== previousState.data && state.data) {
      queryRunner.setState({ data: state.data });
      stateListeners.forEach((listener) => listener(state.data!.state));
    }
  });

  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    stateListeners.clear();
    subscription.unsubscribe();
    canonicalQuerySubscription?.unsubscribe();
    previewRunner.cancelQuery();
    queryRunner.setState({ data: baselineData });
    panel.setState({ $behaviors: panel.state.$behaviors?.filter((behavior) => behavior !== previewRunner) });
    previewRunner.clearParent();
  };

  canonicalQuerySubscription = queryRunner.subscribeToState((state, previousState) => {
    if (state.queries === previousState.queries) {
      return;
    }

    if (!isEqual(state.queries, baselineQueries)) {
      dispose();
    }
  });

  queryRunner.cancelQuery();
  panel.setState({ $behaviors: [...(panel.state.$behaviors ?? []), previewRunner] });
  previewRunner.runQueries();

  return {
    dispose,
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
