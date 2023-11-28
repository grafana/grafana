import { __awaiter } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { DataSourceApi, FieldType, createDataFrame, } from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { serializeParams } from '../../../core/utils/fetch';
import { apiPrefix } from './constants';
import { createGraphFrames } from './utils/graphTransform';
import { transformResponse } from './utils/transforms';
export class ZipkinDatasource extends DataSourceApi {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        super(instanceSettings);
        this.instanceSettings = instanceSettings;
        this.templateSrv = templateSrv;
        this.uploadedJson = null;
        this.nodeGraph = instanceSettings.jsonData.nodeGraph;
    }
    query(options) {
        var _a;
        const target = options.targets[0];
        if (target.queryType === 'upload') {
            if (!this.uploadedJson) {
                return of({ data: [] });
            }
            try {
                const traceData = JSON.parse(this.uploadedJson);
                return of(responseToDataQueryResponse({ data: traceData }, (_a = this.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled));
            }
            catch (error) {
                return of({ error: { message: 'JSON is not valid Zipkin format' }, data: [] });
            }
        }
        if (target.query) {
            const query = this.applyVariables(target, options.scopedVars);
            return this.request(`${apiPrefix}/trace/${encodeURIComponent(query.query)}`).pipe(map((res) => { var _a; return responseToDataQueryResponse(res, (_a = this.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled); }));
        }
        return of(emptyDataQueryResponse);
    }
    metadataRequest(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield lastValueFrom(this.request(url, params, { hideFromInspector: true }));
            return res.data;
        });
    }
    testDatasource() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.metadataRequest(`${apiPrefix}/services`);
            return { status: 'success', message: 'Data source is working' };
        });
    }
    getQueryDisplayText(query) {
        return query.query;
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
        var _a;
        const expandedQuery = Object.assign({}, query);
        return Object.assign(Object.assign({}, expandedQuery), { query: this.templateSrv.replace((_a = query.query) !== null && _a !== void 0 ? _a : '', scopedVars) });
    }
    request(apiUrl, data, options) {
        const params = data ? serializeParams(data) : '';
        const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
        const req = Object.assign(Object.assign({}, options), { url });
        return getBackendSrv().fetch(req);
    }
}
function responseToDataQueryResponse(response, nodeGraph = false) {
    let data = (response === null || response === void 0 ? void 0 : response.data) ? [transformResponse(response === null || response === void 0 ? void 0 : response.data)] : [];
    if (nodeGraph) {
        data.push(...createGraphFrames(response === null || response === void 0 ? void 0 : response.data));
    }
    return {
        data,
    };
}
const emptyDataQueryResponse = {
    data: [
        createDataFrame({
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
                    traceFormat: 'zipkin',
                },
            },
        }),
    ],
};
//# sourceMappingURL=datasource.js.map