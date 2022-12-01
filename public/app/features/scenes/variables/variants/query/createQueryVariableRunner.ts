import { Observable, of } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { runRequest } from 'app/features/query/state/runRequest';
import { hasStandardVariableSupport } from 'app/features/variables/guard';

import { QueryVariable } from './QueryVariable';

export interface RunnerArgs {
  searchFilter?: string;
}

type GetTargetArgs = { variable: QueryVariable };

export interface QueryRunner {
  getTarget: (args: GetTargetArgs) => DataQuery;
  runRequest: (args: RunnerArgs, request: DataQueryRequest) => Observable<PanelData>;
}

class StandardQueryRunner implements QueryRunner {
  public constructor(private datasource: DataSourceApi, private _runRequest = runRequest) {}

  public getTarget({ variable }: GetTargetArgs) {
    if (hasStandardVariableSupport(this.datasource)) {
      return this.datasource.variables.toDataQuery(variable.state.query);
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  public runRequest(args: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(this.datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!this.datasource.variables.query) {
      return this._runRequest(this.datasource, request);
    }

    return this._runRequest(this.datasource, request, this.datasource.variables.query);
  }
}

function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
}

function createQueryVariableRunnerFactory(datasource: DataSourceApi): QueryRunner {
  if (hasStandardVariableSupport(datasource)) {
    return new StandardQueryRunner(datasource, runRequest);
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
