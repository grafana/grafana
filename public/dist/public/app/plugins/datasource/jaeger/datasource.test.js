import { __awaiter } from "tslib";
import { lastValueFrom, of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { dateTime, FieldType, PluginType, } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { ALL_OPERATIONS_KEY } from './components/SearchForm';
import { JaegerDatasource } from './datasource';
import mockJson from './mockJsonResponse.json';
import { testResponse, testResponseDataFrameFields, testResponseEdgesFields, testResponseNodesFields, } from './testResponse';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv, getTemplateSrv: () => ({
        replace: (val, subs) => {
            var _a, _b;
            return (_b = (_a = subs[val]) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : val;
        },
        containsTemplate: (val) => {
            return val.includes('$');
        },
    }) })));
const timeSrvStub = {
    timeRange() {
        return {
            from: dateTime(1531468681),
            to: dateTime(1531489712),
        };
    },
};
describe('JaegerDatasource', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('returns trace and graph when queried', () => __awaiter(void 0, void 0, void 0, function* () {
        setupFetchMock({ data: [testResponse] });
        const ds = new JaegerDatasource(defaultSettings);
        const response = yield lastValueFrom(ds.query(defaultQuery));
        expect(response.data.length).toBe(3);
        expect(response.data[0].fields).toMatchObject(testResponseDataFrameFields);
        expect(response.data[1].fields).toMatchObject(testResponseNodesFields);
        expect(response.data[2].fields).toMatchObject(testResponseEdgesFields);
    }));
    it('returns trace when traceId with special characters is queried', () => __awaiter(void 0, void 0, void 0, function* () {
        const mock = setupFetchMock({ data: [testResponse] });
        const ds = new JaegerDatasource(defaultSettings);
        const query = Object.assign(Object.assign({}, defaultQuery), { targets: [
                {
                    query: 'a/b',
                    refId: '1',
                },
            ] });
        yield lastValueFrom(ds.query(query));
        expect(mock).toBeCalledWith({ url: `${defaultSettings.url}/api/traces/a%2Fb` });
    }));
    it('returns empty response if trace id is not specified', () => __awaiter(void 0, void 0, void 0, function* () {
        const ds = new JaegerDatasource(defaultSettings);
        const response = yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { targets: [] })));
        const field = response.data[0].fields[0];
        expect(field.name).toBe('trace');
        expect(field.type).toBe(FieldType.trace);
        expect(field.values.length).toBe(0);
    }));
    it('should handle json file upload', () => __awaiter(void 0, void 0, void 0, function* () {
        const ds = new JaegerDatasource(defaultSettings);
        ds.uploadedJson = JSON.stringify(mockJson);
        const response = yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { targets: [{ queryType: 'upload', refId: 'A' }] })));
        const field = response.data[0].fields[0];
        expect(field.name).toBe('traceID');
        expect(field.type).toBe(FieldType.string);
        expect(field.values.length).toBe(2);
    }));
    it('should fail on invalid json file upload', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const ds = new JaegerDatasource(defaultSettings);
        ds.uploadedJson = JSON.stringify({ key: 'value', arr: [] });
        const response = yield lastValueFrom(ds.query({
            targets: [{ queryType: 'upload', refId: 'A' }],
        }));
        expect((_a = response.error) === null || _a === void 0 ? void 0 : _a.message).toBe('The JSON file uploaded is not in a valid Jaeger format');
        expect(response.data.length).toBe(0);
    }));
    it('should return search results when the query type is search', () => __awaiter(void 0, void 0, void 0, function* () {
        const mock = setupFetchMock({ data: [testResponse] });
        const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
        const response = yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: '/api/services' }] })));
        expect(mock).toBeCalledWith({
            url: `${defaultSettings.url}/api/traces?service=jaeger-query&operation=%2Fapi%2Fservices&start=1531468681000&end=1531489712000&lookback=custom`,
        });
        expect(response.data[0].meta.preferredVisualisationType).toBe('table');
        // Make sure that traceID field has data link configured
        expect(response.data[0].fields[0].config.links).toHaveLength(1);
        expect(response.data[0].fields[0].name).toBe('traceID');
    }));
    it('should show the correct error message if no service name is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
        const response = yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { targets: [{ queryType: 'search', refId: 'a', service: undefined, operation: '/api/services' }] })));
        expect((_b = response.error) === null || _b === void 0 ? void 0 : _b.message).toBe('You must select a service.');
    }));
    it('should remove operation from the query when all is selected', () => __awaiter(void 0, void 0, void 0, function* () {
        const mock = setupFetchMock({ data: [testResponse] });
        const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
        yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: ALL_OPERATIONS_KEY }] })));
        expect(mock).toBeCalledWith({
            url: `${defaultSettings.url}/api/traces?service=jaeger-query&start=1531468681000&end=1531489712000&lookback=custom`,
        });
    }));
    it('should convert tags from logfmt format to an object', () => __awaiter(void 0, void 0, void 0, function* () {
        const mock = setupFetchMock({ data: [testResponse] });
        const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
        yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', tags: 'error=true' }] })));
        expect(mock).toBeCalledWith({
            url: `${defaultSettings.url}/api/traces?service=jaeger-query&tags=%7B%22error%22%3A%22true%22%7D&start=1531468681000&end=1531489712000&lookback=custom`,
        });
    }));
    it('should resolve templates in traceID', () => __awaiter(void 0, void 0, void 0, function* () {
        const mock = setupFetchMock({ data: [testResponse] });
        const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
        yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { scopedVars: {
                $traceid: {
                    text: 'traceid',
                    value: '5311b0dd0ca8df3463df93c99cb805a6',
                },
            }, targets: [
                {
                    query: '$traceid',
                    refId: '1',
                },
            ] })));
        expect(mock).toBeCalledWith({
            url: `${defaultSettings.url}/api/traces/5311b0dd0ca8df3463df93c99cb805a6`,
        });
    }));
    it('should resolve templates in tags', () => __awaiter(void 0, void 0, void 0, function* () {
        const mock = setupFetchMock({ data: [testResponse] });
        const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
        yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { scopedVars: {
                'error=$error': {
                    text: 'error',
                    value: 'error=true',
                },
            }, targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', tags: 'error=$error' }] })));
        expect(mock).toBeCalledWith({
            url: `${defaultSettings.url}/api/traces?service=jaeger-query&tags=%7B%22error%22%3A%22true%22%7D&start=1531468681000&end=1531489712000&lookback=custom`,
        });
    }));
    it('should interpolate variables correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const mock = setupFetchMock({ data: [testResponse] });
        const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
        const text = 'interpolationText';
        yield lastValueFrom(ds.query(Object.assign(Object.assign({}, defaultQuery), { scopedVars: {
                $interpolationVar: {
                    text: text,
                    value: text,
                },
            }, targets: [
                {
                    queryType: 'search',
                    refId: 'a',
                    service: '$interpolationVar',
                    operation: '$interpolationVar',
                    minDuration: '$interpolationVar',
                    maxDuration: '$interpolationVar',
                },
            ] })));
        expect(mock).toBeCalledWith({
            url: `${defaultSettings.url}/api/traces?service=interpolationText&operation=interpolationText&minDuration=interpolationText&maxDuration=interpolationText&start=1531468681000&end=1531489712000&lookback=custom`,
        });
    }));
});
describe('when performing testDataSource', () => {
    describe('and call succeeds', () => {
        it('should return successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            setupFetchMock({ data: ['service1'] });
            const ds = new JaegerDatasource(defaultSettings);
            const response = yield ds.testDatasource();
            expect(response.status).toEqual('success');
            expect(response.message).toBe('Data source connected and services found.');
        }));
    });
    describe('and call succeeds, but returns no services', () => {
        it('should display an error', () => __awaiter(void 0, void 0, void 0, function* () {
            setupFetchMock(undefined);
            const ds = new JaegerDatasource(defaultSettings);
            const response = yield ds.testDatasource();
            expect(response.status).toEqual('error');
            expect(response.message).toBe('Data source connected, but no services received. Verify that Jaeger is configured properly.');
        }));
    });
    describe('and call returns error with message', () => {
        it('should return the formatted error', () => __awaiter(void 0, void 0, void 0, function* () {
            setupFetchMock(undefined, throwError({
                statusText: 'Not found',
                status: 404,
                data: {
                    message: '404 page not found',
                },
            }));
            const ds = new JaegerDatasource(defaultSettings);
            const response = yield ds.testDatasource();
            expect(response.status).toEqual('error');
            expect(response.message).toBe('Jaeger: Not found. 404. 404 page not found');
        }));
    });
    describe('and call returns error without message', () => {
        it('should return JSON error', () => __awaiter(void 0, void 0, void 0, function* () {
            setupFetchMock(undefined, throwError({
                statusText: 'Bad gateway',
                status: 502,
                data: {
                    errors: ['Could not connect to Jaeger backend'],
                },
            }));
            const ds = new JaegerDatasource(defaultSettings);
            const response = yield ds.testDatasource();
            expect(response.status).toEqual('error');
            expect(response.message).toBe('Jaeger: Bad gateway. 502. {"errors":["Could not connect to Jaeger backend"]}');
        }));
    });
});
function setupFetchMock(response, mock) {
    const defaultMock = () => mock !== null && mock !== void 0 ? mock : of(createFetchResponse(response));
    const fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(defaultMock);
    return fetchMock;
}
const defaultSettings = {
    id: 0,
    uid: '0',
    type: 'tracing',
    name: 'jaeger',
    url: 'http://grafana.com',
    access: 'proxy',
    meta: {
        id: 'jaeger',
        name: 'jaeger',
        type: PluginType.datasource,
        info: {},
        module: '',
        baseUrl: '',
    },
    jsonData: {
        nodeGraph: {
            enabled: true,
        },
    },
    readOnly: false,
};
const defaultQuery = {
    requestId: '1',
    interval: '0',
    intervalMs: 10,
    panelId: 0,
    scopedVars: {},
    range: {
        from: dateTime().subtract(1, 'h'),
        to: dateTime(),
        raw: { from: '1h', to: 'now' },
    },
    timezone: 'browser',
    app: 'explore',
    startTime: 0,
    targets: [
        {
            query: '12345',
            refId: '1',
        },
    ],
};
//# sourceMappingURL=datasource.test.js.map