import { Epic, ActionsObservable, StateObservable } from 'redux-observable';
import { Subject } from 'rxjs';
import {
  DataSourceApi,
  DataQuery,
  DataSourceJsonData,
  DataQueryRequest,
  DataStreamObserver,
  DataQueryResponse,
  DataStreamState,
} from '@grafana/ui';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { EpicDependencies } from 'app/store/configureStore';

export const epicTester = (
  epic: Epic<ActionOf<any>, ActionOf<any>, StoreState, EpicDependencies>,
  state?: Partial<StoreState>
) => {
  const resultingActions: Array<ActionOf<any>> = [];
  const action$ = new Subject<ActionOf<any>>();
  const state$ = new Subject<StoreState>();
  const actionObservable$ = new ActionsObservable(action$);
  const stateObservable$ = new StateObservable(state$, (state as StoreState) || ({} as StoreState));
  const queryResponse$ = new Subject<DataQueryResponse>();
  const observer$ = new Subject<DataStreamState>();
  const getQueryResponse = (
    datasourceInstance: DataSourceApi<DataQuery, DataSourceJsonData>,
    options: DataQueryRequest<DataQuery>,
    observer?: DataStreamObserver
  ) => {
    if (observer) {
      observer$.subscribe({ next: event => observer(event) });
    }
    return queryResponse$;
  };

  const dependencies: EpicDependencies = {
    getQueryResponse,
  };

  epic(actionObservable$, stateObservable$, dependencies).subscribe({ next: action => resultingActions.push(action) });

  const whenActionIsDispatched = (action: ActionOf<any>) => {
    action$.next(action);

    return instance;
  };

  const whenQueryReceivesResponse = (response: DataQueryResponse) => {
    queryResponse$.next(response);

    return instance;
  };

  const whenQueryThrowsError = (error: any) => {
    queryResponse$.error(error);

    return instance;
  };

  const whenQueryObserverReceivesEvent = (event: DataStreamState) => {
    observer$.next(event);

    return instance;
  };

  const thenResultingActionsEqual = (...actions: Array<ActionOf<any>>) => {
    expect(actions).toEqual(resultingActions);

    return instance;
  };

  const thenNoActionsWhereDispatched = () => {
    expect(resultingActions).toEqual([]);

    return instance;
  };

  const instance = {
    whenActionIsDispatched,
    whenQueryReceivesResponse,
    whenQueryThrowsError,
    whenQueryObserverReceivesEvent,
    thenResultingActionsEqual,
    thenNoActionsWhereDispatched,
  };

  return instance;
};
