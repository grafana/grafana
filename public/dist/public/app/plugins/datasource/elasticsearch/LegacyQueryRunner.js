import { __awaiter } from "tslib";
import { first as _first, cloneDeep } from 'lodash';
import { lastValueFrom, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { dateTime, ensureTimeField, LogRowContextQueryDirection, } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { ElasticResponse } from './ElasticResponse';
import { enhanceDataFrameWithDataLinks } from './datasource';
import { defaultBucketAgg, hasMetricOfType } from './queryDef';
import { trackQuery } from './tracking';
export class LegacyQueryRunner {
    constructor(datasource, templateSrv) {
        this.datasource = datasource;
        this.templateSrv = templateSrv;
    }
    request(method, url, data, headers) {
        var _a;
        if (!this.datasource.isProxyAccess) {
            const error = new Error('Browser access mode in the Elasticsearch datasource is no longer available. Switch to server access mode.');
            return throwError(() => error);
        }
        const options = {
            url: this.datasource.url + '/' + url,
            method,
            data,
            headers,
        };
        if (method === 'POST') {
            options.headers = (_a = options.headers) !== null && _a !== void 0 ? _a : {};
            options.headers['Content-Type'] = 'application/x-ndjson';
        }
        if (this.datasource.basicAuth || this.datasource.withCredentials) {
            options.withCredentials = true;
        }
        if (this.datasource.basicAuth) {
            options.headers = {
                Authorization: this.datasource.basicAuth,
            };
        }
        return getBackendSrv()
            .fetch(options)
            .pipe(map((results) => {
            results.data.$$config = results.config;
            return results.data;
        }), catchError((err) => {
            var _a, _b, _c;
            if (err.data) {
                const message = (_c = (_b = (_a = err.data.error) === null || _a === void 0 ? void 0 : _a.reason) !== null && _b !== void 0 ? _b : err.data.message) !== null && _c !== void 0 ? _c : 'Unknown error';
                return throwError({
                    message,
                    error: err.data.error,
                });
            }
            return throwError(err);
        }));
    }
    logContextQuery(row, options) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const sortField = row.dataFrame.fields.find((f) => f.name === 'sort');
            const searchAfter = (sortField === null || sortField === void 0 ? void 0 : sortField.values[row.rowIndex]) || [row.timeEpochMs];
            const sort = (options === null || options === void 0 ? void 0 : options.direction) === LogRowContextQueryDirection.Forward ? 'asc' : 'desc';
            const header = (options === null || options === void 0 ? void 0 : options.direction) === LogRowContextQueryDirection.Forward
                ? this.datasource.getQueryHeader('query_then_fetch', dateTime(row.timeEpochMs))
                : this.datasource.getQueryHeader('query_then_fetch', undefined, dateTime(row.timeEpochMs));
            const limit = (_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : 10;
            const esQuery = JSON.stringify({
                size: limit,
                query: {
                    bool: {
                        filter: [
                            {
                                range: {
                                    [this.datasource.timeField]: {
                                        [(options === null || options === void 0 ? void 0 : options.direction) === LogRowContextQueryDirection.Forward ? 'gte' : 'lte']: row.timeEpochMs,
                                        format: 'epoch_millis',
                                    },
                                },
                            },
                        ],
                    },
                },
                sort: [{ [this.datasource.timeField]: sort }, { _doc: sort }],
                search_after: searchAfter,
            });
            const payload = [header, esQuery].join('\n') + '\n';
            const url = this.datasource.getMultiSearchUrl();
            const response = yield lastValueFrom(this.request('POST', url, payload));
            const targets = [{ refId: `${row.dataFrame.refId}`, metrics: [{ type: 'logs', id: '1' }] }];
            const elasticResponse = new ElasticResponse(targets, transformHitsBasedOnDirection(response, sort));
            const logResponse = elasticResponse.getLogs(this.datasource.logMessageField, this.datasource.logLevelField);
            const dataFrame = _first(logResponse.data);
            if (!dataFrame) {
                return { data: [] };
            }
            /**
             * The LogRowContext requires there is a field in the dataFrame.fields
             * named `ts` for timestamp and `line` for the actual log line to display.
             * Unfortunatly these fields are hardcoded and are required for the lines to
             * be properly displayed. This code just copies the fields based on this.timeField
             * and this.logMessageField and recreates the dataFrame so it works.
             */
            const timestampField = dataFrame.fields.find((f) => f.name === this.datasource.timeField);
            const lineField = dataFrame.fields.find((f) => f.name === this.datasource.logMessageField);
            const otherFields = dataFrame.fields.filter((f) => f !== timestampField && f !== lineField);
            if (timestampField && lineField) {
                return {
                    data: [
                        Object.assign(Object.assign({}, dataFrame), { fields: [ensureTimeField(timestampField), lineField, ...otherFields] }),
                    ],
                };
            }
            return logResponse;
        });
    }
    query(request) {
        var _a, _b, _c;
        let payload = '';
        const targets = this.datasource.interpolateVariablesInQueries(cloneDeep(request.targets), request.scopedVars);
        const sentTargets = [];
        let targetsContainsLogsQuery = targets.some((target) => hasMetricOfType(target, 'logs'));
        const logLimits = [];
        for (const target of targets) {
            if (target.hide) {
                continue;
            }
            let queryObj;
            if (hasMetricOfType(target, 'logs')) {
                // FIXME: All this logic here should be in the query builder.
                // When moving to the BE-only implementation we should remove this and let the BE
                // Handle this.
                // TODO: defaultBucketAgg creates a dete_histogram aggregation without a field, so it fallbacks to
                // the configured timeField. we should allow people to use a different time field here.
                target.bucketAggs = [defaultBucketAgg()];
                const log = (_a = target.metrics) === null || _a === void 0 ? void 0 : _a.find((m) => m.type === 'logs');
                const limit = ((_b = log.settings) === null || _b === void 0 ? void 0 : _b.limit) ? parseInt((_c = log.settings) === null || _c === void 0 ? void 0 : _c.limit, 10) : 500;
                logLimits.push(limit);
                target.metrics = [];
                // Setting this for metrics queries that are typed as logs
                queryObj = this.datasource.queryBuilder.getLogsQuery(target, limit);
            }
            else {
                logLimits.push();
                if (target.alias) {
                    target.alias = this.datasource.interpolateLuceneQuery(target.alias, request.scopedVars);
                }
                queryObj = this.datasource.queryBuilder.build(target);
            }
            const esQuery = JSON.stringify(queryObj);
            const searchType = 'query_then_fetch';
            const header = this.datasource.getQueryHeader(searchType, request.range.from, request.range.to);
            payload += header + '\n';
            payload += esQuery + '\n';
            sentTargets.push(target);
        }
        if (sentTargets.length === 0) {
            return of({ data: [] });
        }
        // We replace the range here for actual values. We need to replace it together with enclosing "" so that we replace
        // it as an integer not as string with digits. This is because elastic will convert the string only if the time
        // field is specified as type date (which probably should) but can also be specified as integer (millisecond epoch)
        // and then sending string will error out.
        payload = payload.replace(/"\$timeFrom"/g, request.range.from.valueOf().toString());
        payload = payload.replace(/"\$timeTo"/g, request.range.to.valueOf().toString());
        payload = this.templateSrv.replace(payload, request.scopedVars);
        const url = this.datasource.getMultiSearchUrl();
        const start = new Date();
        return this.request('POST', url, payload).pipe(map((res) => {
            const er = new ElasticResponse(sentTargets, res);
            // TODO: This needs to be revisited, it seems wrong to process ALL the sent queries as logs if only one of them was a log query
            if (targetsContainsLogsQuery) {
                const response = er.getLogs(this.datasource.logMessageField, this.datasource.logLevelField);
                response.data.forEach((dataFrame, index) => {
                    enhanceDataFrame(dataFrame, this.datasource.dataLinks, logLimits[index]);
                });
                return response;
            }
            return er.getTimeSeries();
        }), tap((response) => trackQuery(response, request, start)));
    }
}
function transformHitsBasedOnDirection(response, direction) {
    if (direction === 'desc') {
        return response;
    }
    const actualResponse = response.responses[0];
    return Object.assign(Object.assign({}, response), { responses: [
            Object.assign(Object.assign({}, actualResponse), { hits: Object.assign(Object.assign({}, actualResponse.hits), { hits: actualResponse.hits.hits.reverse() }) }),
        ] });
}
/**
 * Modifies dataFrame and adds dataLinks from the config.
 * Exported for tests.
 */
export function enhanceDataFrame(dataFrame, dataLinks, limit) {
    if (limit) {
        dataFrame.meta = Object.assign(Object.assign({}, dataFrame.meta), { limit });
    }
    enhanceDataFrameWithDataLinks(dataFrame, dataLinks);
}
//# sourceMappingURL=LegacyQueryRunner.js.map