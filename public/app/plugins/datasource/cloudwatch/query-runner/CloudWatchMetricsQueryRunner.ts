import { findLast, isEmpty } from 'lodash';
import React from 'react';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateTimeFormat,
  FieldType,
  rangeUtil,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { toDataQueryResponse } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { store } from 'app/store/store';
import { AppNotificationTimeout } from 'app/types';

import { ThrottlingErrorMessage } from '../components/ThrottlingErrorMessage';
import memoizedDebounce from '../memoizedDebounce';
import { migrateMetricQuery } from '../migrations/metricQueryMigrations';
import {
  CloudWatchJsonData,
  CloudWatchMetricsQuery,
  CloudWatchQuery,
  DataQueryError,
  MetricQuery,
  MetricRequest,
} from '../types';
import { filterMetricsQuery } from '../utils/utils';

import { CloudWatchRequest } from './CloudWatchRequest';

const displayAlert = (datasourceName: string, region: string) =>
  store.dispatch(
    notifyApp(
      createErrorNotification(
        `CloudWatch request limit reached in ${region} for data source ${datasourceName}`,
        '',
        undefined,
        React.createElement(ThrottlingErrorMessage, { region }, null)
      )
    )
  );
// This class handles execution of CloudWatch metrics query data queries
export class CloudWatchMetricsQueryRunner extends CloudWatchRequest {
  debouncedAlert: (datasourceName: string, region: string) => void = memoizedDebounce(
    displayAlert,
    AppNotificationTimeout.Error
  );

  constructor(instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
    super(instanceSettings, templateSrv);
  }

  handleMetricQueries = (
    metricQueries: CloudWatchMetricsQuery[],
    options: DataQueryRequest<CloudWatchQuery>
  ): Observable<DataQueryResponse> => {
    const timezoneUTCOffset = dateTimeFormat(Date.now(), {
      timeZone: options.timezone,
      format: 'Z',
    }).replace(':', '');

    const validMetricsQueries = metricQueries
      .filter(this.filterMetricQuery)
      .map((q: CloudWatchMetricsQuery): MetricQuery => {
        const migratedQuery = migrateMetricQuery(q);
        const migratedAndIterpolatedQuery = this.replaceMetricQueryVars(migratedQuery, options.scopedVars);

        return {
          timezoneUTCOffset,
          intervalMs: options.intervalMs,
          maxDataPoints: options.maxDataPoints,
          ...migratedAndIterpolatedQuery,
          type: 'timeSeriesQuery',
          datasource: this.ref,
        };
      });

    // No valid targets, return the empty result to save a round trip.
    if (isEmpty(validMetricsQueries)) {
      return of({ data: [] });
    }

    const request = {
      from: options?.range?.from.valueOf().toString(),
      to: options?.range?.to.valueOf().toString(),
      queries: validMetricsQueries,
    };

    return this.performTimeSeriesQuery(request, options.range);
  };

  interpolateMetricsQueryVariables(
    query: CloudWatchMetricsQuery,
    scopedVars: ScopedVars
  ): Pick<CloudWatchMetricsQuery, 'alias' | 'metricName' | 'namespace' | 'period' | 'dimensions' | 'sqlExpression'> {
    return {
      alias: this.replaceVariableAndDisplayWarningIfMulti(query.alias, scopedVars),
      metricName: this.replaceVariableAndDisplayWarningIfMulti(query.metricName, scopedVars),
      namespace: this.replaceVariableAndDisplayWarningIfMulti(query.namespace, scopedVars),
      period: this.replaceVariableAndDisplayWarningIfMulti(query.period, scopedVars),
      sqlExpression: this.replaceVariableAndDisplayWarningIfMulti(query.sqlExpression, scopedVars),
      dimensions: this.convertDimensionFormat(query.dimensions ?? {}, scopedVars),
    };
  }

  performTimeSeriesQuery(request: MetricRequest, { from, to }: TimeRange): Observable<DataQueryResponse> {
    return this.awsRequest(this.dsQueryEndpoint, request).pipe(
      map((res) => {
        const dataframes: DataFrame[] = toDataQueryResponse({ data: res }).data;
        if (!dataframes || dataframes.length <= 0) {
          return { data: [] };
        }

        const lastError = findLast(res.results, (v) => !!v.error);

        dataframes.forEach((frame) => {
          frame.fields.forEach((field) => {
            if (field.type === FieldType.time) {
              // field.config.interval is populated in order for Grafana to fill in null values at frame intervals
              field.config.interval = frame.meta?.custom?.period * 1000;
            }
          });
        });

        return {
          data: dataframes,
          error: lastError ? { message: lastError.error } : undefined,
        };
      }),
      catchError((err: DataQueryError<CloudWatchMetricsQuery>) => {
        const isFrameError = err.data?.results;

        // Error is not frame specific
        if (!isFrameError && err.data && err.data.message === 'Metric request error' && err.data.error) {
          err.message = err.data.error;
          return throwError(() => err);
        }

        // The error is either for a specific frame or for all the frames
        const results: Array<{ error?: string }> = Object.values(err.data?.results ?? {});
        const firstErrorResult = results.find((r) => r.error);
        if (firstErrorResult) {
          err.message = firstErrorResult.error;
        }

        if (results.some((r) => r.error && /^Throttling:.*/.test(r.error))) {
          const failedRedIds = Object.keys(err.data?.results ?? {});
          const regionsAffected = Object.values(request.queries).reduce(
            (res: string[], { refId, region }) =>
              (refId && !failedRedIds.includes(refId)) || res.includes(region) ? res : [...res, region],
            []
          );
          regionsAffected.forEach((region) => {
            const actualRegion = this.getActualRegion(region);
            if (actualRegion) {
              this.debouncedAlert(this.instanceSettings.name, actualRegion);
            }
          });
        }

        return throwError(() => err);
      })
    );
  }

  filterMetricQuery(query: CloudWatchMetricsQuery): boolean {
    return filterMetricsQuery(query);
  }

  replaceMetricQueryVars(query: CloudWatchMetricsQuery, scopedVars: ScopedVars): CloudWatchMetricsQuery {
    query.region = this.templateSrv.replace(this.getActualRegion(query.region), scopedVars);
    query.namespace = this.replaceVariableAndDisplayWarningIfMulti(query.namespace, scopedVars, true, 'namespace');
    query.metricName = this.replaceVariableAndDisplayWarningIfMulti(query.metricName, scopedVars, true, 'metric name');
    query.dimensions = this.convertDimensionFormat(query.dimensions ?? {}, scopedVars);
    query.statistic = this.templateSrv.replace(query.statistic, scopedVars);
    query.period = String(this.getPeriod(query, scopedVars)); // use string format for period in graph query, and alerting
    query.id = this.templateSrv.replace(query.id, scopedVars);
    query.expression = this.templateSrv.replace(query.expression, scopedVars);
    query.sqlExpression = this.templateSrv.replace(query.sqlExpression, scopedVars, 'raw');
    if (query.accountId) {
      query.accountId = this.templateSrv.replace(query.accountId, scopedVars);
    }

    return query;
  }

  getPeriod(target: CloudWatchMetricsQuery, scopedVars: ScopedVars) {
    let period = this.templateSrv.replace(target.period, scopedVars);
    if (period && period.toLowerCase() !== 'auto') {
      let p: number;
      if (/^\d+$/.test(period)) {
        p = parseInt(period, 10);
      } else {
        p = rangeUtil.intervalToSeconds(period);
      }

      if (p < 1) {
        p = 1;
      }

      return String(p);
    }

    return period;
  }
}
