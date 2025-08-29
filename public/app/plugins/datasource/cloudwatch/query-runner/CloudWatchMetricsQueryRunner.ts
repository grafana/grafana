import { isEmpty } from 'lodash';
import { createElement } from 'react';
import { catchError, map, Observable, of } from 'rxjs';

import {
  AppEvents,
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateTimeFormat,
  FieldType,
  rangeUtil,
  ScopedVars,
} from '@grafana/data';
import { TemplateSrv, getAppEvents } from '@grafana/runtime';

import { ThrottlingErrorMessage } from '../components/Errors/ThrottlingErrorMessage';
import memoizedDebounce from '../memoizedDebounce';
import { migrateMetricQuery } from '../migrations/metricQueryMigrations';
import { CloudWatchJsonData, CloudWatchMetricsQuery, CloudWatchQuery } from '../types';
import { filterMetricsQuery } from '../utils/utils';

import { CloudWatchRequest } from './CloudWatchRequest';

const getThrottlingErrorMessage = (region: string, message: string) =>
  `Please visit the AWS Service Quotas console at https://${region}.console.aws.amazon.com/servicequotas/home?region=${region}#!/services/monitoring/quotas/L-5E141212 to request a quota increase or see our documentation at https://grafana.com/docs/grafana/latest/datasources/cloudwatch/#manage-service-quotas to learn more. ${message}`;

const displayAlert = (datasourceName: string, region: string) =>
  getAppEvents().publish({
    type: AppEvents.alertError.name,
    payload: [
      `CloudWatch request limit reached in ${region} for data source ${datasourceName}`,
      '',
      undefined,
      createElement(ThrottlingErrorMessage, { region }, null),
    ],
  });

// This class handles execution of CloudWatch metrics query data queries
export class CloudWatchMetricsQueryRunner extends CloudWatchRequest {
  debouncedThrottlingAlert: (datasourceName: string, region: string) => void = memoizedDebounce(displayAlert);

  constructor(instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
    super(instanceSettings, templateSrv);
  }

  handleMetricQueries = (
    metricQueries: CloudWatchMetricsQuery[],
    options: DataQueryRequest<CloudWatchQuery>,
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>
  ): Observable<DataQueryResponse> => {
    const timezoneUTCOffset = dateTimeFormat(Date.now(), {
      timeZone: options.timezone,
      format: 'Z',
    }).replace(':', '');

    const validMetricsQueries = metricQueries.filter(this.filterMetricQuery).map((q) => {
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

    const request: DataQueryRequest<CloudWatchQuery> = {
      ...options,
      requestId: options.requestId + '-metrics', // adding -metrics to prevent requestId from matching logs queries sent from the same panel
      targets: validMetricsQueries,
    };

    return this.performTimeSeriesQuery(request, queryFn);
  };

  interpolateMetricsQueryVariables(
    query: CloudWatchMetricsQuery,
    scopedVars: ScopedVars
  ): Pick<
    CloudWatchMetricsQuery,
    'alias' | 'metricName' | 'namespace' | 'period' | 'dimensions' | 'sqlExpression' | 'expression'
  > {
    return {
      alias: this.replaceVariableAndDisplayWarningIfMulti(query.alias, scopedVars),
      metricName: this.replaceVariableAndDisplayWarningIfMulti(query.metricName, scopedVars),
      namespace: this.replaceVariableAndDisplayWarningIfMulti(query.namespace, scopedVars),
      period: this.replaceVariableAndDisplayWarningIfMulti(query.period, scopedVars),
      expression: this.templateSrv.replace(query.expression, scopedVars),
      sqlExpression: this.replaceVariableAndDisplayWarningIfMulti(query.sqlExpression, scopedVars),
      dimensions: this.convertDimensionFormat(query.dimensions ?? {}, scopedVars),
    };
  }

  performTimeSeriesQuery(
    request: DataQueryRequest<CloudWatchQuery>,
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>
  ): Observable<DataQueryResponse> {
    return queryFn(request).pipe(
      map((res) => {
        const dataframes: DataFrame[] = res.data || [];

        dataframes.forEach((frame) => {
          frame.fields.forEach((field) => {
            if (field.type === FieldType.time) {
              // field.config.interval is populated in order for Grafana to fill in null values at frame intervals
              field.config.interval = frame.meta?.custom?.period * 1000;
            }
          });
        });

        if (res.errors?.length) {
          this.alertOnThrottlingErrors(res.errors, request);
        }

        return {
          data: dataframes,
          // DataSourceWithBackend will not throw an error, instead it will return "errors" field along with the response
          errors: this.enrichThrottlingErrorMessages(request, res.errors),
        };
      }),
      catchError((err: unknown) => {
        if (Array.isArray(err)) {
          return of({ data: [], errors: err });
        } else {
          return of({ data: [], errors: [{ message: err }] });
        }
      })
    );
  }

  enrichThrottlingErrorMessages(request: DataQueryRequest<CloudWatchQuery>, errors?: DataQueryError[]) {
    if (!errors || errors.length === 0) {
      return errors;
    }
    const result: DataQueryError[] = [];
    errors.forEach((error) => {
      if (error.message && (/^Throttling:.*/.test(error.message) || /^Rate exceeded.*/.test(error.message))) {
        const region = this.getActualRegion(request.targets.find((target) => target.refId === error.refId)?.region);
        result.push({ ...error, message: getThrottlingErrorMessage(region, error.message) });
      } else {
        result.push(error);
      }
    });
    return result;
  }

  alertOnThrottlingErrors(errors: DataQueryError[], request: DataQueryRequest<CloudWatchQuery>) {
    const hasThrottlingError = errors.some(
      (err) => err.message && (/^Throttling:.*/.test(err.message) || /^Rate exceeded.*/.test(err.message))
    );
    if (hasThrottlingError) {
      const failedRefIds = errors.map((error) => error.refId).filter((refId) => refId);
      if (failedRefIds.length > 0) {
        const regionsAffected = Object.values(request.targets).reduce(
          (res: string[], { refId, region }) =>
            (refId && !failedRefIds.includes(refId)) || res.includes(region) ? res : [...res, region],
          []
        );
        regionsAffected.forEach((region) => {
          const actualRegion = this.getActualRegion(region);
          if (actualRegion) {
            this.debouncedThrottlingAlert(this.instanceSettings.name, actualRegion);
          }
        });
      }
    }
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
