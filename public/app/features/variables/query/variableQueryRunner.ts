import { EMPTY, from, merge, Observable, of, Subject, throwError, Unsubscribable } from 'rxjs';
import { catchError, filter, finalize, map, mergeMap, takeUntil, tap } from 'rxjs/operators';
import {
  DataQuery,
  DataSourceApi,
  DataSourceJsonData,
  LoadingState,
  MetricFindValue,
  ScopedVars,
  VariableSupport,
} from '@grafana/data';

import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { getVariable } from '../state/selectors';
import { QueryVariableModel } from '../types';
import { runRequest } from '../../dashboard/state/runRequest';
import { updateVariableOptions, updateVariableTags } from './reducer';
import { StoreState, ThunkDispatch } from '../../../types';
import { dispatch, getState } from '../../../store/store';
import { getLegacyQueryOptions, getTemplatedRegex } from '../utils';
import { validateVariableSelectionState } from '../state/actions';

interface UpdateOptionsArgs {
  identifier: VariableIdentifier;
  dataSource: DataSourceApi;
  searchFilter?: string;
}

interface UpdateOptionsResults {
  state: LoadingState;
  identifier: VariableIdentifier;
  error?: any;
}

interface VariableQueryRunnerArgs {
  dispatch: ThunkDispatch;
  getState: () => StoreState;
  getVariable: typeof getVariable;
  getTemplatedRegex: typeof getTemplatedRegex;
}

interface DataSourceWithVariableSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  variables: VariableSupport<TQuery>;
}

interface DataSourceWithMetricFindSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  metricFindQuery(query: any, options?: any): Promise<MetricFindValue[]>;
}

class VariableQueryRunner {
  private readonly updateOptionsRequests: Subject<UpdateOptionsArgs>;
  private readonly updateOptionsResults: Subject<UpdateOptionsResults>;
  private readonly cancelRequests: Subject<{ identifier: VariableIdentifier }>;
  private readonly subscription: Unsubscribable;

  constructor(private dependencies: VariableQueryRunnerArgs = { dispatch, getState, getVariable, getTemplatedRegex }) {
    this.updateOptionsRequests = new Subject<UpdateOptionsArgs>();
    this.updateOptionsResults = new Subject<UpdateOptionsResults>();
    this.cancelRequests = new Subject<{ identifier: VariableIdentifier }>();
    this.queueRequest = this.queueRequest.bind(this);
    this.onNewRequest = this.onNewRequest.bind(this);
    this.runUpdateOptionsRequest = this.runUpdateOptionsRequest.bind(this);
    this.cancelRequest = this.cancelRequest.bind(this);
    this.subscription = this.updateOptionsRequests.subscribe(this.onNewRequest);
  }

  queueRequest(args: UpdateOptionsArgs): Observable<UpdateOptionsResults> {
    this.updateOptionsRequests.next(args);
    return this.updateOptionsResults.asObservable().pipe(filter(result => result.identifier === args.identifier));
  }

  cancelRequest(identifier: VariableIdentifier): void {
    this.cancelRequests.next({ identifier });
  }

  destroy(): void {
    this.subscription.unsubscribe();
  }

  onNewRequest(args: UpdateOptionsArgs): void {
    const { dataSource, identifier, searchFilter } = args;
    const beforeUid = getState().templating.transaction.uid;

    const variableInState = this.dependencies.getVariable<QueryVariableModel>(
      identifier.id,
      this.dependencies.getState()
    );

    let observable: Observable<MetricFindValue[]> = EMPTY;

    if (this.hasVariableSupport(dataSource)) {
      observable = this.runUpdateOptionsRequest(variableInState, args);
    } else if (this.hasMetricFindSupport(dataSource)) {
      const queryOptions = getLegacyQueryOptions(variableInState, searchFilter);
      observable = from(dataSource.metricFindQuery(variableInState.query, queryOptions));
    }

    this.updateOptionsResults.next({ identifier, state: LoadingState.Loading });

    observable
      .pipe(
        filter(() => {
          // lets check if we started another batch during the execution of the observable. If so we just want to abort the rest.
          const afterUid = getState().templating.transaction.uid;
          return beforeUid === afterUid;
        }),
        mergeMap(results => {
          const templatedRegex = this.dependencies.getTemplatedRegex(variableInState);
          const payload = toVariablePayload(variableInState, { results, templatedRegex });
          this.dependencies.dispatch(updateVariableOptions(payload));

          return this.runUpdateTagsRequest(variableInState, args);
        }),
        mergeMap(() => {
          // If we are searching options there is no need to validate selection state
          // This condition was added to as validateVariableSelectionState will update the current value of the variable
          // So after search and selection the current value is already update so no setValue, refresh & url update is performed
          // The if statement below fixes https://github.com/grafana/grafana/issues/25671
          if (!searchFilter) {
            return from(
              this.dependencies.dispatch(validateVariableSelectionState(toVariableIdentifier(variableInState)))
            );
          }

          return of([]);
        }),
        takeUntil(
          merge(this.updateOptionsRequests, this.cancelRequests).pipe(
            filter(args => {
              let cancelRequest = false;

              if (args.identifier.id === identifier.id) {
                cancelRequest = true;
              }

              return cancelRequest;
            })
          )
        ),
        catchError(error => {
          this.updateOptionsResults.next({ identifier, state: LoadingState.Error, error });
          return throwError(error);
        }),
        finalize(() => {
          this.updateOptionsResults.next({ identifier, state: LoadingState.Done });
        })
      )
      .subscribe();
  }

  runUpdateOptionsRequest(variable: QueryVariableModel, args: UpdateOptionsArgs): Observable<MetricFindValue[]> {
    const { dataSource, searchFilter } = args;
    const variableAsVars = { variable: { text: variable.current.text, value: variable.current.value } };
    const searchFilterAsVars = searchFilter
      ? {
          searchFilter: { text: searchFilter, value: searchFilter },
        }
      : {};
    const scopedVars = { ...searchFilterAsVars, ...variableAsVars } as ScopedVars;
    const request = dataSource.variables!.toDataQueryRequest(variable.query, scopedVars);

    return new Observable<MetricFindValue[]>(observer => {
      const subscription = runRequest(dataSource, request)
        .pipe(
          map(panelData => panelData.series),
          dataSource.variables!.toMetricFindValues()
        )
        .subscribe(observer);

      const unsubscribe = () => {
        subscription.unsubscribe();
      };

      return unsubscribe;
    });
  }

  runUpdateTagsRequest(variable: QueryVariableModel, args: UpdateOptionsArgs): Observable<MetricFindValue[]> {
    const { dataSource, searchFilter } = args;

    if (variable.useTags && this.hasMetricFindSupport(dataSource)) {
      return from(dataSource.metricFindQuery(variable.tagsQuery, getLegacyQueryOptions(variable, searchFilter))).pipe(
        tap(tagResults => {
          this.dependencies.dispatch(updateVariableTags(toVariablePayload(variable, tagResults)));
        })
      );
    }

    return of([]);
  }

  private hasVariableSupport(datasource: DataSourceApi): datasource is DataSourceWithVariableSupport {
    return Boolean(datasource.variables);
  }

  private hasMetricFindSupport(datasource: DataSourceApi): datasource is DataSourceWithMetricFindSupport {
    return Boolean(datasource.metricFindQuery);
  }
}

export const variableQueryRunner = new VariableQueryRunner();
