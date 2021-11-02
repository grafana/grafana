import { __assign, __awaiter, __generator } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { FieldType } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { ZipkinDatasource } from './datasource';
import mockJson from './mockJsonResponse.json';
import { traceFrameFields, zipkinResponse } from './utils/testData';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
describe('ZipkinDatasource', function () {
    describe('query', function () {
        it('runs query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setupBackendSrv(zipkinResponse);
                        ds = new ZipkinDatasource(defaultSettings);
                        return [4 /*yield*/, expect(ds.query({ targets: [{ query: '12345' }] })).toEmitValuesWith(function (val) {
                                expect(val[0].data[0].fields).toMatchObject(traceFrameFields);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('runs query with traceId that includes special characters', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setupBackendSrv(zipkinResponse);
                        ds = new ZipkinDatasource(defaultSettings);
                        return [4 /*yield*/, expect(ds.query({ targets: [{ query: 'a/b' }] })).toEmitValuesWith(function (val) {
                                expect(val[0].data[0].fields).toMatchObject(traceFrameFields);
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle json file upload', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, response, field;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ds = new ZipkinDatasource(defaultSettings);
                        ds.uploadedJson = JSON.stringify(mockJson);
                        return [4 /*yield*/, lastValueFrom(ds.query({
                                targets: [{ queryType: 'upload', refId: 'A' }],
                            }))];
                    case 1:
                        response = _a.sent();
                        field = response.data[0].fields[0];
                        expect(field.name).toBe('traceID');
                        expect(field.type).toBe(FieldType.string);
                        expect(field.values.length).toBe(3);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should fail on invalid json file upload', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, response;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        ds = new ZipkinDatasource(defaultSettings);
                        ds.uploadedJson = JSON.stringify({ key: 'value', arr: [] });
                        return [4 /*yield*/, lastValueFrom(ds.query({
                                targets: [{ queryType: 'upload', refId: 'A' }],
                            }))];
                    case 1:
                        response = _b.sent();
                        expect((_a = response.error) === null || _a === void 0 ? void 0 : _a.message).toBeDefined();
                        expect(response.data.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('metadataRequest', function () {
        it('runs query', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ds, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setupBackendSrv(['service 1', 'service 2']);
                        ds = new ZipkinDatasource(defaultSettings);
                        return [4 /*yield*/, ds.metadataRequest('/api/v2/services')];
                    case 1:
                        response = _a.sent();
                        expect(response).toEqual(['service 1', 'service 2']);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function setupBackendSrv(response) {
    var defaultMock = function () { return of(createFetchResponse(response)); };
    var fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(defaultMock);
}
var defaultSettings = {
    id: 1,
    uid: '1',
    type: 'tracing',
    name: 'zipkin',
    meta: {},
    jsonData: {},
    access: 'proxy',
};
//# sourceMappingURL=datasource.test.js.map