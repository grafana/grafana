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
  DefaultTimeZone,
} from '@grafana/ui';

import { ActionOf } from 'app/core/redux/actionCreatorFactory';
import { StoreState } from 'app/types/store';
import { EpicDependencies } from 'app/store/configureStore';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { DEFAULT_RANGE } from 'app/core/utils/explore';

export const MOCKED_ABSOLUTE_RANGE = { from: 1, to: 2 };

export const epicTester = (
  epic: Epic<ActionOf<any>, ActionOf<any>, StoreState, EpicDependencies>,
  state?: Partial<StoreState>,
  dependencies?: Partial<EpicDependencies>
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
  const init = jest.fn();
  const getTimeSrv = (): TimeSrv => {
    const timeSrvMock: TimeSrv = {} as TimeSrv;

    return Object.assign(timeSrvMock, { init });
  };

  const getTimeRange = jest.fn().mockReturnValue(DEFAULT_RANGE);

  const getShiftedTimeRange = jest.fn().mockReturnValue(MOCKED_ABSOLUTE_RANGE);

  const getTimeZone = jest.fn().mockReturnValue(DefaultTimeZone);

  const toUtc = jest.fn().mockReturnValue(null);

  const dateTime = jest.fn().mockReturnValue(null);

  const defaultDependencies: EpicDependencies = {
    getQueryResponse,
    getTimeSrv,
    getTimeRange,
    getTimeZone,
    toUtc,
    dateTime,
    getShiftedTimeRange,
  };

  const theDependencies: EpicDependencies = { ...defaultDependencies, ...dependencies };

  epic(actionObservable$, stateObservable$, theDependencies).subscribe({
    next: action => resultingActions.push(action),
  });

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

  const getDependencyMock = (dependency: string, method?: string) => {
    // @ts-ignore
    const dep = theDependencies[dependency];
    let mock = null;
    if (dep instanceof Function) {
      mock = method ? dep()[method] : dep();
    } else {
      mock = method ? dep[method] : dep;
    }

    return mock;
  };

  const thenDependencyWasCalledTimes = (times: number, dependency: string, method?: string) => {
    const mock = getDependencyMock(dependency, method);
    expect(mock).toBeCalledTimes(times);

    return instance;
  };

  const thenDependencyWasCalledWith = (args: any[], dependency: string, method?: string) => {
    const mock = getDependencyMock(dependency, method);
    expect(mock).toBeCalledWith(...args);

    return instance;
  };

  const instance = {
    whenActionIsDispatched,
    whenQueryReceivesResponse,
    whenQueryThrowsError,
    whenQueryObserverReceivesEvent,
    thenResultingActionsEqual,
    thenNoActionsWhereDispatched,
    thenDependencyWasCalledTimes,
    thenDependencyWasCalledWith,
  };

  return instance;
};
