import { from, Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { DataQuery, DataQueryRequest, DataSourceApi, DefaultTimeRange, LoadingState, PanelData } from '@grafana/data';

import { QueryVariableModel } from '../types';
import {
  hasCustomVariableSupport,
  hasDatasourceVariableSupport,
  hasLegacyVariableSupport,
  hasStandardVariableSupport,
} from '../guard';
import { getLegacyQueryOptions } from '../utils';
import { TimeSrv } from '../../dashboard/services/TimeSrv';

export interface RunnerArgs {
  variable: QueryVariableModel;
  dataSource: DataSourceApi;
  timeSrv: TimeSrv;
  runRequest: (
    datasource: DataSourceApi,
    request: DataQueryRequest,
    queryFunction?: typeof datasource.query
  ) => Observable<PanelData>;
  searchFilter?: string;
}

type QueryRunnerType = 'legacy' | 'standard' | 'custom' | 'datasource';
type GetTargetArgs = { dataSource: DataSourceApi; variable: QueryVariableModel };

export interface QueryRunner {
  type: QueryRunnerType;
  canRun: (dataSource: DataSourceApi) => boolean;
  getTarget: (args: GetTargetArgs) => DataQuery;
  runRequest: (args: RunnerArgs, request: DataQueryRequest) => Observable<PanelData>;
}

export class QueryRunners {
  private readonly runners: QueryRunner[];
  constructor() {
    this.runners = [
      new LegacyQueryRunner(),
      new StandardQueryRunner(),
      new CustomQueryRunner(),
      new DatasourceQueryRunner(),
    ];
  }

  getRunnerForDatasource(datasource: DataSourceApi): QueryRunner {
    const runner = this.runners.find(runner => runner.canRun(datasource));
    if (runner) {
      return runner;
    }

    throw new Error("Couldn't find a query runner that matches supplied arguments.");
  }
}

class LegacyQueryRunner implements QueryRunner {
  type: QueryRunnerType = 'legacy';

  canRun(dataSource: DataSourceApi) {
    return hasLegacyVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: GetTargetArgs) {
    if (hasLegacyVariableSupport(dataSource)) {
      return variable.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ dataSource, variable, searchFilter, timeSrv }: RunnerArgs, request: DataQueryRequest) {
    if (!hasLegacyVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    const queryOptions: any = getLegacyQueryOptions(variable, searchFilter, timeSrv);

    return from(dataSource.metricFindQuery(variable.query, queryOptions)).pipe(
      mergeMap(values => {
        if (!values || !values.length) {
          return getEmptyMetricFindValueObservable();
        }

        const series: any = values;
        return of({ series, state: LoadingState.Done, timeRange: DefaultTimeRange });
      })
    );
  }
}

class StandardQueryRunner implements QueryRunner {
  type: QueryRunnerType = 'standard';

  canRun(dataSource: DataSourceApi) {
    return hasStandardVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: GetTargetArgs) {
    if (hasStandardVariableSupport(dataSource)) {
      return dataSource.variables.standard.toDataQuery(variable.query);
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ dataSource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!dataSource.variables.standard.query) {
      return runRequest(dataSource, request);
    }

    return runRequest(dataSource, request, dataSource.variables.standard.query);
  }
}

class CustomQueryRunner implements QueryRunner {
  type: QueryRunnerType = 'custom';

  canRun(dataSource: DataSourceApi) {
    return hasCustomVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: GetTargetArgs) {
    if (hasCustomVariableSupport(dataSource)) {
      return variable.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ dataSource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasCustomVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(dataSource, request, dataSource.variables.custom.query);
  }
}

class DatasourceQueryRunner implements QueryRunner {
  type: QueryRunnerType = 'datasource';

  canRun(dataSource: DataSourceApi) {
    return hasDatasourceVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: GetTargetArgs) {
    if (hasDatasourceVariableSupport(dataSource)) {
      return variable.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ dataSource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasDatasourceVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(dataSource, request);
  }
}

function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({ state: LoadingState.Done, series: [], timeRange: DefaultTimeRange });
}
