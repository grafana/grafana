import { from, mergeMap, Observable, of } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { runRequest } from 'app/features/query/state/runRequest';
import { hasLegacyVariableSupport, hasStandardVariableSupport } from 'app/features/variables/guard';

import { QueryVariable } from './QueryVariable';

export interface RunnerArgs {
  searchFilter?: string;
  variable: QueryVariable;
}

export interface QueryRunner {
  getTarget: (variable: QueryVariable) => DataQuery;
  runRequest: (args: RunnerArgs, request: DataQueryRequest) => Observable<PanelData>;
}

class StandardQueryRunner implements QueryRunner {
  public constructor(private datasource: DataSourceApi, private _runRequest = runRequest) {}

  public getTarget(variable: QueryVariable) {
    if (hasStandardVariableSupport(this.datasource)) {
      return this.datasource.variables.toDataQuery(variable.state.query);
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  public runRequest(_: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!this.datasource.variables.query) {
      return this._runRequest(this.datasource, request);
    }

    return this._runRequest(this.datasource, request, this.datasource.variables.query);
  }
}

class LegacyQueryRunner implements QueryRunner {
  public constructor(private datasource: DataSourceApi) {}

  public getTarget(variable: QueryVariable) {
    if (hasLegacyVariableSupport(this.datasource)) {
      return variable.state.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  public runRequest({ variable }: RunnerArgs, request: DataQueryRequest) {
    if (!hasLegacyVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    return from(
      this.datasource.metricFindQuery(variable.state.query, {
        ...request,
        // variable is used by SQL common data source
        variable: {
          name: variable.state.name,
          type: variable.state.type,
        },
        // TODO: add support for search filter
        // searchFilter
      })
    ).pipe(
      mergeMap((values) => {
        if (!values || !values.length) {
          return getEmptyMetricFindValueObservable();
        }

        const series: any = values;
        return of({ series, state: LoadingState.Done, timeRange: request.range });
      })
    );
  }
}

function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
}

function createQueryVariableRunnerFactory(datasource: DataSourceApi): QueryRunner {
  if (hasStandardVariableSupport(datasource)) {
    return new StandardQueryRunner(datasource, runRequest);
  }

  if (hasLegacyVariableSupport(datasource)) {
    return new LegacyQueryRunner(datasource);
  }

  // TODO: add support for legacy, cutom and datasource query runners

  throw new Error(`Couldn't create a query runner for datasource ${datasource.type}`);
}

export let createQueryVariableRunner = createQueryVariableRunnerFactory;

/**
 * Use only in tests
 */
export function setCreateQueryVariableRunnerFactory(fn: (datasource: DataSourceApi) => QueryRunner) {
  createQueryVariableRunner = fn;
}
