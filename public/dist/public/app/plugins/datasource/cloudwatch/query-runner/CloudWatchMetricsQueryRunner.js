import { findLast, isEmpty } from 'lodash';
import React from 'react';
import { catchError, map, of, throwError } from 'rxjs';
import { dateTimeFormat, FieldType, rangeUtil, } from '@grafana/data';
import { toDataQueryResponse } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { store } from 'app/store/store';
import { AppNotificationTimeout } from 'app/types';
import { ThrottlingErrorMessage } from '../components/Errors/ThrottlingErrorMessage';
import memoizedDebounce from '../memoizedDebounce';
import { migrateMetricQuery } from '../migrations/metricQueryMigrations';
import { filterMetricsQuery } from '../utils/utils';
import { CloudWatchRequest } from './CloudWatchRequest';
const displayAlert = (datasourceName, region) => store.dispatch(notifyApp(createErrorNotification(`CloudWatch request limit reached in ${region} for data source ${datasourceName}`, '', undefined, React.createElement(ThrottlingErrorMessage, { region }, null))));
// This class handles execution of CloudWatch metrics query data queries
export class CloudWatchMetricsQueryRunner extends CloudWatchRequest {
    constructor(instanceSettings, templateSrv) {
        super(instanceSettings, templateSrv);
        this.debouncedAlert = memoizedDebounce(displayAlert, AppNotificationTimeout.Error);
        this.handleMetricQueries = (metricQueries, options) => {
            var _a, _b;
            const timezoneUTCOffset = dateTimeFormat(Date.now(), {
                timeZone: options.timezone,
                format: 'Z',
            }).replace(':', '');
            const validMetricsQueries = metricQueries
                .filter(this.filterMetricQuery)
                .map((q) => {
                const migratedQuery = migrateMetricQuery(q);
                const migratedAndIterpolatedQuery = this.replaceMetricQueryVars(migratedQuery, options.scopedVars);
                return Object.assign(Object.assign({ timezoneUTCOffset, intervalMs: options.intervalMs, maxDataPoints: options.maxDataPoints }, migratedAndIterpolatedQuery), { type: 'timeSeriesQuery', datasource: this.ref });
            });
            // No valid targets, return the empty result to save a round trip.
            if (isEmpty(validMetricsQueries)) {
                return of({ data: [] });
            }
            const request = {
                from: (_a = options === null || options === void 0 ? void 0 : options.range) === null || _a === void 0 ? void 0 : _a.from.valueOf().toString(),
                to: (_b = options === null || options === void 0 ? void 0 : options.range) === null || _b === void 0 ? void 0 : _b.to.valueOf().toString(),
                queries: validMetricsQueries,
            };
            return this.performTimeSeriesQuery(request, options.range);
        };
    }
    interpolateMetricsQueryVariables(query, scopedVars) {
        var _a;
        return {
            alias: this.replaceVariableAndDisplayWarningIfMulti(query.alias, scopedVars),
            metricName: this.replaceVariableAndDisplayWarningIfMulti(query.metricName, scopedVars),
            namespace: this.replaceVariableAndDisplayWarningIfMulti(query.namespace, scopedVars),
            period: this.replaceVariableAndDisplayWarningIfMulti(query.period, scopedVars),
            expression: this.templateSrv.replace(query.expression, scopedVars),
            sqlExpression: this.replaceVariableAndDisplayWarningIfMulti(query.sqlExpression, scopedVars),
            dimensions: this.convertDimensionFormat((_a = query.dimensions) !== null && _a !== void 0 ? _a : {}, scopedVars),
        };
    }
    performTimeSeriesQuery(request, { from, to }) {
        return this.awsRequest(this.dsQueryEndpoint, request).pipe(map((res) => {
            const dataframes = toDataQueryResponse(res).data;
            if (!dataframes || dataframes.length <= 0) {
                return { data: [] };
            }
            const lastError = findLast(res.data.results, (v) => !!v.error);
            dataframes.forEach((frame) => {
                frame.fields.forEach((field) => {
                    var _a, _b;
                    if (field.type === FieldType.time) {
                        // field.config.interval is populated in order for Grafana to fill in null values at frame intervals
                        field.config.interval = ((_b = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b.period) * 1000;
                    }
                });
            });
            return {
                data: dataframes,
                error: lastError ? { message: lastError.error } : undefined,
            };
        }), catchError((err) => {
            var _a, _b, _c, _d, _e;
            const isFrameError = (_a = err.data) === null || _a === void 0 ? void 0 : _a.results;
            // Error is not frame specific
            if (!isFrameError && err.data && err.data.message === 'Metric request error' && err.data.error) {
                err.message = err.data.error;
                return throwError(() => err);
            }
            // The error is either for a specific frame or for all the frames
            const results = Object.values((_c = (_b = err.data) === null || _b === void 0 ? void 0 : _b.results) !== null && _c !== void 0 ? _c : {});
            const firstErrorResult = results.find((r) => r.error);
            if (firstErrorResult) {
                err.message = firstErrorResult.error;
            }
            if (results.some((r) => r.error && /^Throttling:.*/.test(r.error))) {
                const failedRedIds = Object.keys((_e = (_d = err.data) === null || _d === void 0 ? void 0 : _d.results) !== null && _e !== void 0 ? _e : {});
                const regionsAffected = Object.values(request.queries).reduce((res, { refId, region }) => (refId && !failedRedIds.includes(refId)) || res.includes(region) ? res : [...res, region], []);
                regionsAffected.forEach((region) => {
                    const actualRegion = this.getActualRegion(region);
                    if (actualRegion) {
                        this.debouncedAlert(this.instanceSettings.name, actualRegion);
                    }
                });
            }
            return throwError(() => err);
        }));
    }
    filterMetricQuery(query) {
        return filterMetricsQuery(query);
    }
    replaceMetricQueryVars(query, scopedVars) {
        var _a;
        query.region = this.templateSrv.replace(this.getActualRegion(query.region), scopedVars);
        query.namespace = this.replaceVariableAndDisplayWarningIfMulti(query.namespace, scopedVars, true, 'namespace');
        query.metricName = this.replaceVariableAndDisplayWarningIfMulti(query.metricName, scopedVars, true, 'metric name');
        query.dimensions = this.convertDimensionFormat((_a = query.dimensions) !== null && _a !== void 0 ? _a : {}, scopedVars);
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
    getPeriod(target, scopedVars) {
        let period = this.templateSrv.replace(target.period, scopedVars);
        if (period && period.toLowerCase() !== 'auto') {
            let p;
            if (/^\d+$/.test(period)) {
                p = parseInt(period, 10);
            }
            else {
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
//# sourceMappingURL=CloudWatchMetricsQueryRunner.js.map