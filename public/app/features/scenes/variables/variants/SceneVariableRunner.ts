import { catchError, filter, mergeMap, Observable, of, take, throwError } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  CoreApp,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  MetricFindValue,
  PanelData,
  ScopedVars,
  VariableRefresh,
} from '@grafana/data';
import { runRequest } from 'app/features/query/state/runRequest';
import { hasStandardVariableSupport } from 'app/features/variables/guard';
import { toMetricFindValues } from 'app/features/variables/query/operators';

import { SceneTimeRangeState } from '../../core/types';

import { QueryVariableState } from './QueryVariable';

interface RunQueriesArgs {
  datasource: DataSourceApi;
  variable: QueryVariableState;
  timeRange: SceneTimeRangeState;
  searchFilter?: string;
}

export class SceneVariableRunner {
  private runners = new QueryRunners();

  public runQueries(args: RunQueriesArgs): Observable<MetricFindValue[]> {
    const { datasource, searchFilter, variable } = args;
    try {
      const runnerArgs = { variable, datasource, searchFilter, runRequest };
      const runner = this.runners.getRunnerForDatasource(datasource);
      const target = runner.getTarget({ datasource, variable });
      const request = this.getRequest(variable, args, target);

      return runner.runRequest(runnerArgs, request).pipe(
        filter((data) => data.state === LoadingState.Done || data.state === LoadingState.Error), // we only care about done or error for now
        take(1), // take the first result, using first caused a bug where it in some situations throw an uncaught error because of no results had been received yet
        mergeMap((data: PanelData) => {
          if (data.state === LoadingState.Error) {
            return throwError(() => data.error);
          }

          return of(data);
        }),
        toMetricFindValues(),
        catchError((error) => {
          if (error.cancelled) {
            return of([]);
          }

          return throwError(() => error);
        })
      );
    } catch (error) {
      return throwError(() => error);
    }
  }

  private getRequest(variable: QueryVariableState, args: RunQueriesArgs, target: DataQuery) {
    const { searchFilter } = args;
    const variableAsVars = { variable: { text: variable.text, value: variable.value } };
    const searchFilterScope = { searchFilter: { text: searchFilter, value: searchFilter } };
    const searchFilterAsVars = searchFilter ? searchFilterScope : {};
    const scopedVars = { ...searchFilterAsVars, ...variableAsVars } as ScopedVars;

    const range =
      variable.refresh === VariableRefresh.onTimeRangeChanged
        ? {
            from: args.timeRange.from,
            to: args.timeRange.to,
            raw: args.timeRange.raw,
          }
        : getDefaultTimeRange();

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

export interface RunnerArgs {
  variable: QueryVariableState;
  datasource: DataSourceApi;
  runRequest: (
    datasource: DataSourceApi,
    request: DataQueryRequest,
    queryFunction?: typeof datasource.query
  ) => Observable<PanelData>;
  searchFilter?: string;
}

type GetTargetArgs = { datasource: DataSourceApi; variable: QueryVariableState };

export interface QueryRunner {
  canRun: (dataSource: DataSourceApi) => boolean;
  getTarget: (args: GetTargetArgs) => DataQuery;
  runRequest: (args: RunnerArgs, request: DataQueryRequest) => Observable<PanelData>;
}

class StandardQueryRunner implements QueryRunner {
  public canRun(dataSource: DataSourceApi) {
    return hasStandardVariableSupport(dataSource);
  }

  public getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasStandardVariableSupport(datasource)) {
      return datasource.variables.toDataQuery(variable.query);
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  public runRequest({ datasource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!datasource.variables.query) {
      return runRequest(datasource, request);
    }

    return runRequest(datasource, request, datasource.variables.query);
  }
}

function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
}

class QueryRunners {
  private readonly runners: QueryRunner[];
  public constructor() {
    this.runners = [new StandardQueryRunner()];
  }

  public getRunnerForDatasource(datasource: DataSourceApi): QueryRunner {
    const runner = this.runners.find((runner) => runner.canRun(datasource));
    if (runner) {
      return runner;
    }

    throw new Error("Couldn't find a query runner that matches supplied arguments.");
  }
}
