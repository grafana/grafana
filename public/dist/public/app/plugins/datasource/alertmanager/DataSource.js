import { __awaiter, __extends, __generator } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { DataSourceApi } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { AlertManagerImplementation } from './types';
var AlertManagerDatasource = /** @class */ (function (_super) {
    __extends(AlertManagerDatasource, _super);
    function AlertManagerDatasource(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        return _this;
    }
    // `query()` has to be implemented but we actually don't use it, just need this
    // data source to proxy requests.
    // @ts-ignore
    AlertManagerDatasource.prototype.query = function () {
        return of({
            data: [],
        });
    };
    AlertManagerDatasource.prototype._request = function (url) {
        var options = {
            headers: {},
            method: 'GET',
            url: this.instanceSettings.url + url,
        };
        if (this.instanceSettings.basicAuth || this.instanceSettings.withCredentials) {
            this.instanceSettings.withCredentials = true;
        }
        if (this.instanceSettings.basicAuth) {
            options.headers.Authorization = this.instanceSettings.basicAuth;
        }
        return lastValueFrom(getBackendSrv().fetch(options));
    };
    AlertManagerDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var alertmanagerResponse, e_1, e_2, e_3, e_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this.instanceSettings.jsonData.implementation === AlertManagerImplementation.prometheus)) return [3 /*break*/, 8];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this._request('/alertmanager/api/v2/status')];
                    case 2:
                        alertmanagerResponse = _a.sent();
                        if (alertmanagerResponse && (alertmanagerResponse === null || alertmanagerResponse === void 0 ? void 0 : alertmanagerResponse.status) === 200) {
                            return [2 /*return*/, {
                                    status: 'error',
                                    message: 'It looks like you have chosen Prometheus implementation, but detected a Cortex endpoint. Please update implementation selection and try again.',
                                }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _a.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        _a.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, this._request('/api/v2/status')];
                    case 5:
                        alertmanagerResponse = _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        e_2 = _a.sent();
                        return [3 /*break*/, 7];
                    case 7: return [3 /*break*/, 14];
                    case 8:
                        _a.trys.push([8, 10, , 11]);
                        return [4 /*yield*/, this._request('/api/v2/status')];
                    case 9:
                        alertmanagerResponse = _a.sent();
                        if (alertmanagerResponse && (alertmanagerResponse === null || alertmanagerResponse === void 0 ? void 0 : alertmanagerResponse.status) === 200) {
                            return [2 /*return*/, {
                                    status: 'error',
                                    message: 'It looks like you have chosen Cortex implementation, but detected a Prometheus endpoint. Please update implementation selection and try again.',
                                }];
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        e_3 = _a.sent();
                        return [3 /*break*/, 11];
                    case 11:
                        _a.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, this._request('/alertmanager/api/v2/status')];
                    case 12:
                        alertmanagerResponse = _a.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        e_4 = _a.sent();
                        return [3 /*break*/, 14];
                    case 14: return [2 /*return*/, (alertmanagerResponse === null || alertmanagerResponse === void 0 ? void 0 : alertmanagerResponse.status) === 200
                            ? {
                                status: 'success',
                                message: 'Health check passed.',
                            }
                            : {
                                status: 'error',
                                message: 'Health check failed.',
                            }];
                }
            });
        });
    };
    return AlertManagerDatasource;
}(DataSourceApi));
export { AlertManagerDatasource };
//# sourceMappingURL=DataSource.js.map