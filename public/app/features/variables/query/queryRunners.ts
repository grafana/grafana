import { from, Observable, of } from 'rxjs';
import { DataQuery, DataQueryRequest, DataSourceApi, DefaultTimeRange, LoadingState, PanelData } from '@grafana/data';

import { QueryVariableModel } from '../types';
import {
  hasCustomVariableSupport,
  hasDatasourceVariableSupport,
  hasLegacyVariableSupport,
  hasStandardVariableSupport,
} from '../guard';
import { runRequest } from 'app/features/dashboard/state/runRequest';
import { getLegacyQueryOptions } from '../utils';
import { mergeMap } from 'rxjs/operators';
import { TimeSrv } from '../../dashboard/services/TimeSrv';

export interface RunnerArgs {
  dataSource: DataSourceApi;
  searchFilter?: string;
  variable: QueryVariableModel;
  timeSrv: TimeSrv;
}

export interface QueryRunner {
  canRun: (args: RunnerArgs) => boolean;
  getTarget: (args: RunnerArgs) => DataQuery | null;
  runRequest: (args: RunnerArgs, request: DataQueryRequest) => Observable<PanelData>;
}

export function getQueryRunners(): QueryRunner[] {
  return [new LegacyQueryRunner(), new StandardQueryRunner(), new CustomQueryRunner(), new DatasourceQueryRunner()];
}

export class LegacyQueryRunner implements QueryRunner {
  canRun({ dataSource }: RunnerArgs) {
    return hasLegacyVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: RunnerArgs) {
    if (!hasLegacyVariableSupport(dataSource)) {
      return null;
    }

    return variable.query;
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
        return of({ series, state: LoadingState.Done, timeRange: timeSrv.timeRange() });
      })
    );
  }
}

export class StandardQueryRunner implements QueryRunner {
  canRun({ dataSource }: RunnerArgs) {
    return hasStandardVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: RunnerArgs) {
    if (!hasStandardVariableSupport(dataSource)) {
      return null;
    }

    return dataSource.variables.standard.toDataQuery(variable.query);
  }

  runRequest({ dataSource }: RunnerArgs, request: DataQueryRequest) {
    if (!hasStandardVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    if (!dataSource.variables.standard.query) {
      runRequest(dataSource, request);
    }

    return runRequest(dataSource, request, dataSource.variables.standard.query);
  }
}

export class CustomQueryRunner implements QueryRunner {
  canRun({ dataSource }: RunnerArgs) {
    return hasCustomVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: RunnerArgs) {
    if (!hasCustomVariableSupport(dataSource)) {
      return null;
    }

    return variable.query;
  }

  runRequest({ dataSource }: RunnerArgs, request: DataQueryRequest) {
    if (!hasCustomVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(dataSource, request, dataSource.variables.custom.query);
  }
}

export class DatasourceQueryRunner implements QueryRunner {
  canRun({ dataSource }: RunnerArgs) {
    return hasDatasourceVariableSupport(dataSource);
  }

  getTarget({ dataSource, variable }: RunnerArgs) {
    if (!hasDatasourceVariableSupport(dataSource)) {
      return null;
    }

    return variable.query;
  }

  runRequest({ dataSource }: RunnerArgs, request: DataQueryRequest) {
    if (!hasDatasourceVariableSupport(dataSource)) {
      return getEmptyMetricFindValueObservable();
    }

    return runRequest(dataSource, request);
  }
}

export function getEmptyMetricFindValueObservable(): Observable<PanelData> {
  return of({ state: LoadingState.Done, series: [], timeRange: DefaultTimeRange });
}
