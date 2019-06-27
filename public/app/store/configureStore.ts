import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import { combineEpics, createEpicMiddleware } from 'redux-observable';
import { createLogger } from 'redux-logger';
import sharedReducers from 'app/core/reducers';
import alertingReducers from 'app/features/alerting/state/reducers';
import teamsReducers from 'app/features/teams/state/reducers';
import apiKeysReducers from 'app/features/api-keys/state/reducers';
import foldersReducers from 'app/features/folders/state/reducers';
import dashboardReducers from 'app/features/dashboard/state/reducers';
import exploreReducers from 'app/features/explore/state/reducers';
import pluginReducers from 'app/features/plugins/state/reducers';
import dataSourcesReducers from 'app/features/datasources/state/reducers';
import usersReducers from 'app/features/users/state/reducers';
import userReducers from 'app/features/profile/state/reducers';
import organizationReducers from 'app/features/org/state/reducers';
import { setStore } from './store';
import { limitMessageRateEpic } from 'app/features/explore/state/epics/limitMessageRateEpic';
import { stateSaveEpic } from 'app/features/explore/state/epics/stateSaveEpic';
import { processQueryResultsEpic } from 'app/features/explore/state/epics/processQueryResultsEpic';
import { processQueryErrorsEpic } from 'app/features/explore/state/epics/processQueryErrorsEpic';
import { runQueriesEpic } from 'app/features/explore/state/epics/runQueriesEpic';
import { runQueriesBatchEpic } from 'app/features/explore/state/epics/runQueriesBatchEpic';
import {
  DataSourceApi,
  DataQueryResponse,
  DataQuery,
  DataSourceJsonData,
  DataQueryRequest,
  DataStreamObserver,
  TimeZone,
  RawTimeRange,
  TimeRange,
  DateTimeInput,
  FormatInput,
  DateTime,
  toUtc,
  dateTime,
  AbsoluteTimeRange,
} from '@grafana/ui';
import { Observable } from 'rxjs';
import { getQueryResponse } from 'app/core/utils/explore';
import { StoreState } from 'app/types/store';
import { toggleLogActionsMiddleware } from 'app/core/middlewares/application';
import { timeEpic } from 'app/features/explore/state/epics/timeEpic';
import { TimeSrv, getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { UserState } from 'app/types/user';
import { getTimeRange } from 'app/core/utils/explore';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { getShiftedTimeRange } from 'app/core/utils/timePicker';

const rootReducers = {
  ...sharedReducers,
  ...alertingReducers,
  ...teamsReducers,
  ...apiKeysReducers,
  ...foldersReducers,
  ...dashboardReducers,
  ...exploreReducers,
  ...pluginReducers,
  ...dataSourcesReducers,
  ...usersReducers,
  ...userReducers,
  ...organizationReducers,
};

export function addRootReducer(reducers: any) {
  Object.assign(rootReducers, ...reducers);
}

export const rootEpic: any = combineEpics(
  limitMessageRateEpic,
  stateSaveEpic,
  runQueriesEpic,
  runQueriesBatchEpic,
  processQueryResultsEpic,
  processQueryErrorsEpic,
  timeEpic
);

export interface EpicDependencies {
  getQueryResponse: (
    datasourceInstance: DataSourceApi<DataQuery, DataSourceJsonData>,
    options: DataQueryRequest<DataQuery>,
    observer?: DataStreamObserver
  ) => Observable<DataQueryResponse>;
  getTimeSrv: () => TimeSrv;
  getTimeRange: (timeZone: TimeZone, rawRange: RawTimeRange) => TimeRange;
  getTimeZone: (state: UserState) => TimeZone;
  toUtc: (input?: DateTimeInput, formatInput?: FormatInput) => DateTime;
  dateTime: (input?: DateTimeInput, formatInput?: FormatInput) => DateTime;
  getShiftedTimeRange: (direction: number, origRange: TimeRange, timeZone: TimeZone) => AbsoluteTimeRange;
}

const dependencies: EpicDependencies = {
  getQueryResponse,
  getTimeSrv,
  getTimeRange,
  getTimeZone,
  toUtc,
  dateTime,
  getShiftedTimeRange,
};

const epicMiddleware = createEpicMiddleware({ dependencies });

export function configureStore() {
  const composeEnhancers = (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  const rootReducer = combineReducers(rootReducers);
  const logger = createLogger({
    predicate: (getState: () => StoreState) => {
      return getState().application.logActions;
    },
  });
  const storeEnhancers =
    process.env.NODE_ENV !== 'production'
      ? applyMiddleware(toggleLogActionsMiddleware, thunk, epicMiddleware, logger)
      : applyMiddleware(thunk, epicMiddleware);

  const store = createStore(rootReducer, {}, composeEnhancers(storeEnhancers));
  setStore(store);
  epicMiddleware.run(rootEpic);
  return store;
}
