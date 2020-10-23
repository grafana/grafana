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
  datasource: DataSourceApi;
  timeSrv: TimeSrv;
  runRequest: (
    datasource: DataSourceApi,
    request: DataQueryRequest,
    queryFunction?: typeof datasource.query
  ) => Observable<PanelData>;
  searchFilter?: string;
}

type QueryRunnerType = 'legacy' | 'standard' | 'custom' | 'datasource';
type GetTargetArgs = { datasource: DataSourceApi; variable: QueryVariableModel };

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

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasLegacyVariableSupport(datasource)) {
      return variable.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ datasource, variable, searchFilter, timeSrv }: RunnerArgs, request: DataQueryRequest) {
    if (!hasLegacyVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    const queryOptions: any = getLegacyQueryOptions(variable, searchFilter, timeSrv);

    return from(datasource.metricFindQuery(variable.query, queryOptions)).pipe(
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

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasStandardVariableSupport(datasource)) {
      return datasource.variables.standard.toDataQuery(variable.query);
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ datasource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!datasource.variables.standard.query) {
      return runRequest(datasource, request);
    }

    return runRequest(datasource, request, datasource.variables.standard.query);
  }
}

class CustomQueryRunner implements QueryRunner {
  type: QueryRunnerType = 'custom';

  canRun(dataSource: DataSourceApi) {
    return hasCustomVariableSupport(dataSource);
  }

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasCustomVariableSupport(datasource)) {
      return variable.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ datasource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasCustomVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(datasource, request, datasource.variables.custom.query);
  }
}

class DatasourceQueryRunner implements QueryRunner {
  type: QueryRunnerType = 'datasource';

  canRun(dataSource: DataSourceApi) {
    return hasDatasourceVariableSupport(dataSource);
  }

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasDatasourceVariableSupport(datasource)) {
      return variable.query;
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ datasource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasDatasourceVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(datasource, request);
  }
}

function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({ state: LoadingState.Done, series: [], timeRange: DefaultTimeRange });
}
