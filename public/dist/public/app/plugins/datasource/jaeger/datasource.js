import { __awaiter } from "tslib";
import { identity, omit, pick, pickBy } from 'lodash';
import { lastValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DataSourceApi, dateMath, FieldType, MutableDataFrame, } from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { serializeParams } from 'app/core/utils/fetch';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { ALL_OPERATIONS_KEY } from './components/SearchForm';
import { createGraphFrames } from './graphTransform';
import { createTableFrame, createTraceFrame } from './responseTransform';
import { convertTagsLogfmt } from './util';
export class JaegerDatasource extends DataSourceApi {
    constructor(instanceSettings, timeSrv = getTimeSrv(), templateSrv = getTemplateSrv()) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
        this.timeSrv = timeSrv;
        this.templateSrv = templateSrv;
        this.uploadedJson = null;
        this.nodeGraph = instanceSettings.jsonData.nodeGraph;
        this.traceIdTimeParams = instanceSettings.jsonData.traceIdTimeParams;
    }
    metadataRequest(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield lastValueFrom(this._request(url, params, { hideFromInspector: true }));
            return res.data.data;
        });
    }
    isSearchFormValid(query) {
        return !!query.service;
    }
    query(options) {
        var _a;
        // At this moment we expect only one target. In case we somehow change the UI to be able to show multiple
        // traces at one we need to change this.
        const target = options.targets[0];
        if (!target) {
            return of({ data: [emptyTraceDataFrame] });
        }
        if (target.queryType === 'search' && !this.isSearchFormValid(target)) {
            return of({ error: { message: 'You must select a service.' }, data: [] });
        }
        let { start, end } = this.getTimeRange();
        if (target.queryType !== 'search' && target.query) {
            let url = `/api/traces/${encodeURIComponent(this.templateSrv.replace(target.query, options.scopedVars))}`;
            if (this.traceIdTimeParams) {
                url += `?start=${start}&end=${end}`;
            }
            return this._request(url).pipe(map((response) => {
                var _a, _b, _c;
                const traceData = (_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0];
                if (!traceData) {
                    return { data: [emptyTraceDataFrame] };
                }
                let data = [createTraceFrame(traceData)];
                if ((_c = this.nodeGraph) === null || _c === void 0 ? void 0 : _c.enabled) {
                    data.push(...createGraphFrames(traceData));
                }
                return {
                    data,
                };
            }));
        }
        if (target.queryType === 'upload') {
            if (!this.uploadedJson) {
                return of({ data: [] });
            }
            try {
                const traceData = JSON.parse(this.uploadedJson).data[0];
                let data = [createTraceFrame(traceData)];
                if ((_a = this.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled) {
                    data.push(...createGraphFrames(traceData));
                }
                return of({ data });
            }
            catch (error) {
                return of({ error: { message: 'The JSON file uploaded is not in a valid Jaeger format' }, data: [] });
            }
        }
        let jaegerInterpolated = pick(this.applyVariables(target, options.scopedVars), [
            'service',
            'operation',
            'tags',
            'minDuration',
            'maxDuration',
            'limit',
        ]);
        // remove empty properties
        let jaegerQuery = pickBy(jaegerInterpolated, identity);
        if (jaegerQuery.operation === ALL_OPERATIONS_KEY) {
            jaegerQuery = omit(jaegerQuery, 'operation');
        }
        if (jaegerQuery.tags) {
            jaegerQuery = Object.assign(Object.assign({}, jaegerQuery), { tags: convertTagsLogfmt(jaegerQuery.tags.toString()) });
        }
        // TODO: this api is internal, used in jaeger ui. Officially they have gRPC api that should be used.
        return this._request(`/api/traces`, Object.assign(Object.assign(Object.assign({}, jaegerQuery), this.getTimeRange()), { lookback: 'custom' })).pipe(map((response) => {
            return {
                data: [createTableFrame(response.data.data, this.instanceSettings)],
            };
        }));
    }
    interpolateVariablesInQueries(queries, scopedVars) {
        if (!queries || queries.length === 0) {
            return [];
        }
        return queries.map((query) => {
            return Object.assign(Object.assign(Object.assign({}, query), { datasource: this.getRef() }), this.applyVariables(query, scopedVars));
        });
    }
    applyVariables(query, scopedVars) {
        var _a, _b, _c, _d;
        let expandedQuery = Object.assign({}, query);
        if (query.tags && this.templateSrv.containsTemplate(query.tags)) {
            expandedQuery = Object.assign(Object.assign({}, query), { tags: this.templateSrv.replace(query.tags, scopedVars) });
        }
        return Object.assign(Object.assign({}, expandedQuery), { service: this.templateSrv.replace((_a = query.service) !== null && _a !== void 0 ? _a : '', scopedVars), operation: this.templateSrv.replace((_b = query.operation) !== null && _b !== void 0 ? _b : '', scopedVars), minDuration: this.templateSrv.replace((_c = query.minDuration) !== null && _c !== void 0 ? _c : '', scopedVars), maxDuration: this.templateSrv.replace((_d = query.maxDuration) !== null && _d !== void 0 ? _d : '', scopedVars) });
    }
    testDatasource() {
        return __awaiter(this, void 0, void 0, function* () {
            return lastValueFrom(this._request('/api/services').pipe(map((res) => {
                var _a;
                const values = ((_a = res === null || res === void 0 ? void 0 : res.data) === null || _a === void 0 ? void 0 : _a.data) || [];
                const testResult = values.length > 0
                    ? { status: 'success', message: 'Data source connected and services found.' }
                    : {
                        status: 'error',
                        message: 'Data source connected, but no services received. Verify that Jaeger is configured properly.',
                    };
                return testResult;
            }), catchError((err) => {
                let message = 'Jaeger: ';
                if (err.statusText) {
                    message += err.statusText;
                }
                else {
                    message += 'Cannot connect to Jaeger';
                }
                if (err.status) {
                    message += `. ${err.status}`;
                }
                if (err.data && err.data.message) {
                    message += `. ${err.data.message}`;
                }
                else if (err.data) {
                    message += `. ${JSON.stringify(err.data)}`;
                }
                return of({ status: 'error', message: message });
            })));
        });
    }
    getTimeRange() {
        const range = this.timeSrv.timeRange();
        return {
            start: getTime(range.from, false),
            end: getTime(range.to, true),
        };
    }
    getQueryDisplayText(query) {
        return query.query || '';
    }
    _request(apiUrl, data, options) {
        const params = data ? serializeParams(data) : '';
        const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
        const req = Object.assign(Object.assign({}, options), { url });
        return getBackendSrv().fetch(req);
    }
}
function getTime(date, roundUp) {
    if (typeof date === 'string') {
        date = dateMath.parse(date, roundUp);
    }
    return date.valueOf() * 1000;
}
const emptyTraceDataFrame = new MutableDataFrame({
    fields: [
        {
            name: 'trace',
            type: FieldType.trace,
            values: [],
        },
    ],
    meta: {
        preferredVisualisationType: 'trace',
        custom: {
            traceFormat: 'jaeger',
        },
    },
});
//# sourceMappingURL=datasource.js.map