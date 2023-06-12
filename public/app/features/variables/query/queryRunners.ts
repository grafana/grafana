import { from, Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  VariableSupportType,
} from '@grafana/data';

import { TimeSrv } from '../../dashboard/services/TimeSrv';
import {
  hasCustomVariableSupport,
  hasDatasourceVariableSupport,
  hasLegacyVariableSupport,
  hasStandardVariableSupport,
} from '../guard';
import { QueryVariableModel } from '../types';
import { getLegacyQueryOptions } from '../utils';

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

type GetTargetArgs = { datasource: DataSourceApi; variable: QueryVariableModel };

export interface QueryRunner {
  type: VariableSupportType;
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
    const runner = this.runners.find((runner) => runner.canRun(datasource));
    if (runner) {
      return runner;
    }

    throw new Error("Couldn't find a query runner that matches supplied arguments.");
  }
}

class LegacyQueryRunner implements QueryRunner {
  type = VariableSupportType.Legacy;

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
      mergeMap((values) => {
        if (!values || !values.length) {
          return getEmptyMetricFindValueObservable();
        }

        const series: any = values;
        return of({ series, state: LoadingState.Done, timeRange: queryOptions.range });
      })
    );
  }
}

class StandardQueryRunner implements QueryRunner {
  type = VariableSupportType.Standard;

  canRun(dataSource: DataSourceApi) {
    return hasStandardVariableSupport(dataSource);
  }

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasStandardVariableSupport(datasource)) {
      return datasource.variables.toDataQuery(variable.query);
    }

    throw new Error("Couldn't create a target with supplied arguments.");
  }

  runRequest({ datasource, runRequest }: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(datasource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!datasource.variables.query) {
      return runRequest(datasource, request);
    }

    return runRequest(datasource, request, datasource.variables.query);
  }
}

class CustomQueryRunner implements QueryRunner {
  type = VariableSupportType.Custom;

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

    return runRequest(datasource, request, datasource.variables.query);
  }
}

export const variableDummyRefId = 'variable-query';

class DatasourceQueryRunner implements QueryRunner {
  type = VariableSupportType.Datasource;

  canRun(dataSource: DataSourceApi) {
    return hasDatasourceVariableSupport(dataSource);
  }

  getTarget({ datasource, variable }: GetTargetArgs) {
    if (hasDatasourceVariableSupport(datasource)) {
      return { ...variable.query, refId: variable.query.refId ?? variableDummyRefId };
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
  return of({ state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() });
}
