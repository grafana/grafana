import { merge, Observable, of, Subject, throwError, Unsubscribable } from 'rxjs';
import { catchError, filter, finalize, mergeMap, take, takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import {
  CoreApp,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  LoadingState,
  PanelData,
  QueryVariableModel,
  ScopedVars,
} from '@grafana/data';
import { StoreState, ThunkDispatch } from 'app/types/store';

import { dispatch, getState } from '../../../store/store';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { runRequest } from '../../query/state/runRequest';
import { getLastKey, getVariable } from '../state/selectors';
import { KeyedVariableIdentifier } from '../state/types';
import { getTemplatedRegex } from '../utils';

import { toMetricFindValuesOperator, updateOptionsState, validateVariableSelection } from './operators';
import { QueryRunners } from './queryRunners';

interface UpdateOptionsArgs {
  identifier: KeyedVariableIdentifier;
  datasource: DataSourceApi;
  searchFilter?: string;
}

export interface UpdateOptionsResults {
  state: LoadingState;
  identifier: KeyedVariableIdentifier;
  error?: any;
  cancelled?: boolean;
}

interface VariableQueryRunnerArgs {
  dispatch: ThunkDispatch;
  getState: () => StoreState;
  getVariable: typeof getVariable;
  getTemplatedRegex: typeof getTemplatedRegex;
  getTimeSrv: typeof getTimeSrv;
  queryRunners: QueryRunners;
  runRequest: typeof runRequest;
}

export class VariableQueryRunner {
  private readonly updateOptionsRequests: Subject<UpdateOptionsArgs>;
  private readonly updateOptionsResults: Subject<UpdateOptionsResults>;
  private readonly cancelRequests: Subject<{ identifier: KeyedVariableIdentifier }>;
  private readonly subscription: Unsubscribable;

  constructor(
    private dependencies: VariableQueryRunnerArgs = {
      dispatch,
      getState,
      getVariable,
      getTemplatedRegex,
      getTimeSrv,
      queryRunners: new QueryRunners(),
      runRequest,
    }
  ) {
    this.updateOptionsRequests = new Subject<UpdateOptionsArgs>();
    this.updateOptionsResults = new Subject<UpdateOptionsResults>();
    this.cancelRequests = new Subject<{ identifier: KeyedVariableIdentifier }>();
    this.onNewRequest = this.onNewRequest.bind(this);
    this.subscription = this.updateOptionsRequests.subscribe(this.onNewRequest);
  }

  queueRequest(args: UpdateOptionsArgs): void {
    this.updateOptionsRequests.next(args);
  }

  getResponse(identifier: KeyedVariableIdentifier): Observable<UpdateOptionsResults> {
    return this.updateOptionsResults.asObservable().pipe(filter((result) => result.identifier === identifier));
  }

  cancelRequest(identifier: KeyedVariableIdentifier): void {
    this.cancelRequests.next({ identifier });
  }

  destroy(): void {
    this.subscription.unsubscribe();
  }

  private onNewRequest(args: UpdateOptionsArgs): void {
    const { datasource, identifier, searchFilter } = args;
    try {
      const {
        dispatch,
        runRequest,
        getTemplatedRegex: getTemplatedRegexFunc,
        getVariable,
        queryRunners,
        getTimeSrv,
        getState,
      } = this.dependencies;

      const beforeKey = getLastKey(getState());

      this.updateOptionsResults.next({ identifier, state: LoadingState.Loading });

      const variable = getVariable(identifier, getState());
      if (variable.type !== 'query') {
        return;
      }

      const timeSrv = getTimeSrv();
      const runnerArgs = { variable, datasource, searchFilter, timeSrv, runRequest };
      //if query runner is not available for the datasource, we should return early
      if (!queryRunners.isQueryRunnerAvailableForDatasource(datasource)) {
        const error = new Error('Query Runner is not available for datasource.');
        this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
        return;
      }

      const runner = queryRunners.getRunnerForDatasource(datasource);
      const target = runner.getTarget({ datasource, variable });
      const request = this.getRequest(variable, args, target);

      runner
        .runRequest(runnerArgs, request)
        .pipe(
          filter(() => {
            // Lets check if we started another batch during the execution of the observable. If so we just want to abort the rest.
            const afterKey = getLastKey(getState());

            return beforeKey === afterKey;
          }),
          filter((data) => data.state === LoadingState.Done || data.state === LoadingState.Error), // we only care about done or error for now
          take(1), // take the first result, using first caused a bug where it in some situations throw an uncaught error because of no results had been received yet
          mergeMap((data: PanelData) => {
            if (data.state === LoadingState.Error) {
              return throwError(() => data.error);
            }

            return of(data);
          }),
          toMetricFindValuesOperator(),
          updateOptionsState({ variable, dispatch, getTemplatedRegexFunc }),
          validateVariableSelection({ variable, dispatch, searchFilter }),
          takeUntil(
            merge(this.updateOptionsRequests, this.cancelRequests).pipe(
              filter((args) => {
                let cancelRequest = false;

                if (args.identifier.id === identifier.id) {
                  cancelRequest = true;
                  this.updateOptionsResults.next({ identifier, state: LoadingState.Loading, cancelled: cancelRequest });
                }

                return cancelRequest;
              })
            )
          ),
          catchError((error) => {
            if (error.cancelled) {
              return of({});
            }

            this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
            return throwError(() => error);
          }),
          finalize(() => {
            this.updateOptionsResults.next({ identifier, state: LoadingState.Done });
          })
        )
        .subscribe();
    } catch (error) {
      this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
    }
  }

  private getRequest(variable: QueryVariableModel, args: UpdateOptionsArgs, target: DataQuery) {
    const { searchFilter } = args;
    const variableAsVars = { variable: { text: variable.current.text, value: variable.current.value } };
    const searchFilterScope = { searchFilter: { text: searchFilter, value: searchFilter } };
    const searchFilterAsVars = searchFilter ? searchFilterScope : {};
    const scopedVars = { ...searchFilterAsVars, ...variableAsVars } as ScopedVars;
    const range = this.dependencies.getTimeSrv().timeRange();

    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: uuidv4(),
      timezone: '',
      range,
      interval: '',
      intervalMs: 0,
      targets: [target],
      scopedVars,
      startTime: Date.now(),
    };

    return request;
  }
}

let singleton: VariableQueryRunner;

export function setVariableQueryRunner(runner: VariableQueryRunner): void {
  singleton = runner;
}

export function getVariableQueryRunner(): VariableQueryRunner {
  return singleton;
}
