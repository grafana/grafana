import { __assign, __awaiter, __extends, __generator, __read, __spreadArray } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { getBackendSrv } from '@grafana/runtime';
import { DataSourceApi, FieldType, MutableDataFrame, } from '@grafana/data';
import { serializeParams } from '../../../core/utils/fetch';
import { apiPrefix } from './constants';
import { createGraphFrames } from './utils/graphTransform';
import { transformResponse } from './utils/transforms';
var ZipkinDatasource = /** @class */ (function (_super) {
    __extends(ZipkinDatasource, _super);
    function ZipkinDatasource(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        _this.uploadedJson = null;
        _this.nodeGraph = instanceSettings.jsonData.nodeGraph;
        return _this;
    }
    ZipkinDatasource.prototype.query = function (options) {
        var _this = this;
        var _a;
        var target = options.targets[0];
        if (target.queryType === 'upload') {
            if (!this.uploadedJson) {
                return of({ data: [] });
            }
            try {
                var traceData = JSON.parse(this.uploadedJson);
                return of(responseToDataQueryResponse({ data: traceData }, (_a = this.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled));
            }
            catch (error) {
                return of({ error: { message: 'JSON is not valid Zipkin format' }, data: [] });
            }
        }
        if (target.query) {
            return this.request(apiPrefix + "/trace/" + encodeURIComponent(target.query)).pipe(map(function (res) { var _a; return responseToDataQueryResponse(res, (_a = _this.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled); }));
        }
        return of(emptyDataQueryResponse);
    };
    ZipkinDatasource.prototype.metadataRequest = function (url, params) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lastValueFrom(this.request(url, params, { hideFromInspector: true }))];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.data];
                }
            });
        });
    };
    ZipkinDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.metadataRequest(apiPrefix + "/services")];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, { status: 'success', message: 'Data source is working' }];
                }
            });
        });
    };
    ZipkinDatasource.prototype.getQueryDisplayText = function (query) {
        return query.query;
    };
    ZipkinDatasource.prototype.request = function (apiUrl, data, options) {
        var params = data ? serializeParams(data) : '';
        var url = "" + this.instanceSettings.url + apiUrl + (params.length ? "?" + params : '');
        var req = __assign(__assign({}, options), { url: url });
        return getBackendSrv().fetch(req);
    };
    return ZipkinDatasource;
}(DataSourceApi));
export { ZipkinDatasource };
function responseToDataQueryResponse(response, nodeGraph) {
    if (nodeGraph === void 0) { nodeGraph = false; }
    var data = (response === null || response === void 0 ? void 0 : response.data) ? [transformResponse(response === null || response === void 0 ? void 0 : response.data)] : [];
    if (nodeGraph) {
        data.push.apply(data, __spreadArray([], __read(createGraphFrames(response === null || response === void 0 ? void 0 : response.data)), false));
    }
    return {
        data: data,
    };
}
var emptyDataQueryResponse = {
    data: [
        new MutableDataFrame({
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