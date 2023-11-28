import { __awaiter } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { FieldType } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { ZipkinDatasource } from './datasource';
import mockJson from './mockJsonResponse.json';
import { traceFrameFields, zipkinResponse } from './utils/testData';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
describe('ZipkinDatasource', () => {
    describe('query', () => {
        const templateSrv = {
            replace: jest.fn(),
            getVariables: jest.fn(),
            containsTemplate: jest.fn(),
            updateTimeRange: jest.fn(),
        };
        it('runs query', () => __awaiter(void 0, void 0, void 0, function* () {
            setupBackendSrv(zipkinResponse);
            const ds = new ZipkinDatasource(defaultSettings, templateSrv);
            yield expect(ds.query({ targets: [{ query: '12345' }] })).toEmitValuesWith((val) => {
                expect(val[0].data[0].fields).toMatchObject(traceFrameFields);
            });
        }));
        it('runs query with traceId that includes special characters', () => __awaiter(void 0, void 0, void 0, function* () {
            setupBackendSrv(zipkinResponse);
            const ds = new ZipkinDatasource(defaultSettings, templateSrv);
            yield expect(ds.query({ targets: [{ query: 'a/b' }] })).toEmitValuesWith((val) => {
                expect(val[0].data[0].fields).toMatchObject(traceFrameFields);
            });
        }));
        it('should handle json file upload', () => __awaiter(void 0, void 0, void 0, function* () {
            const ds = new ZipkinDatasource(defaultSettings);
            ds.uploadedJson = JSON.stringify(mockJson);
            const response = yield lastValueFrom(ds.query({
                targets: [{ queryType: 'upload', refId: 'A' }],
            }));
            const field = response.data[0].fields[0];
            expect(field.name).toBe('traceID');
            expect(field.type).toBe(FieldType.string);
            expect(field.values.length).toBe(3);
        }));
        it('should fail on invalid json file upload', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const ds = new ZipkinDatasource(defaultSettings);
            ds.uploadedJson = JSON.stringify({ key: 'value', arr: [] });
            const response = yield lastValueFrom(ds.query({
                targets: [{ queryType: 'upload', refId: 'A' }],
            }));
            expect((_a = response.error) === null || _a === void 0 ? void 0 : _a.message).toBeDefined();
            expect(response.data.length).toBe(0);
        }));
    });
    describe('metadataRequest', () => {
        it('runs query', () => __awaiter(void 0, void 0, void 0, function* () {
            setupBackendSrv(['service 1', 'service 2']);
            const ds = new ZipkinDatasource(defaultSettings);
            const response = yield ds.metadataRequest('/api/v2/services');
            expect(response).toEqual(['service 1', 'service 2']);
        }));
    });
});
function setupBackendSrv(response) {
    const defaultMock = () => of(createFetchResponse(response));
    const fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(defaultMock);
}
const defaultSettings = {
    id: 1,
    uid: '1',
    type: 'tracing',
    name: 'zipkin',
    meta: {},
    jsonData: {},
    access: 'proxy',
    readOnly: false,
};
//# sourceMappingURL=datasource.test.js.map