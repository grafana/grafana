import { __awaiter } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';
import { dataFrameToJSON, dateTime, FieldType, getDefaultTimeRange, LoadingState, createDataFrame, PluginType, CoreApp, } from '@grafana/data';
import { setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { BarGaugeDisplayMode, TableCellDisplayMode } from '@grafana/schema';
import { TempoVariableQueryType } from './VariableQueryEditor';
import { TraceqlSearchScope } from './dataquery.gen';
import { DEFAULT_LIMIT, TempoDatasource, buildExpr, buildLinkExpr, getRateAlignedValues, makeServiceGraphViewRequest, makeTempoLink, getFieldConfig, getEscapedSpanNames, } from './datasource';
import mockJson from './mockJsonResponse.json';
import mockServiceGraph from './mockServiceGraph.json';
import { createMetadataRequest, createTempoDatasource } from './mocks';
let mockObservable;
jest.mock('@grafana/runtime', () => {
    return Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
            fetch: mockObservable,
            _request: mockObservable,
        }) });
});
describe('Tempo data source', () => {
    // Mock the console error so that running the test suite doesnt throw the error
    const origError = console.error;
    const consoleErrorMock = jest.fn();
    afterEach(() => (console.error = origError));
    beforeEach(() => (console.error = consoleErrorMock));
    it('returns empty response when traceId is empty', () => __awaiter(void 0, void 0, void 0, function* () {
        const templateSrv = { replace: jest.fn() };
        const ds = new TempoDatasource(defaultSettings, templateSrv);
        const response = yield lastValueFrom(ds.query({ targets: [{ refId: 'refid1', queryType: 'traceql', query: '' }] }), { defaultValue: 'empty' });
        expect(response).toBe('empty');
    }));
    describe('Variables should be interpolated correctly', () => {
        function getQuery() {
            return {
                refId: 'x',
                queryType: 'traceql',
                linkedQuery: {
                    refId: 'linked',
                    expr: '{instance="$interpolationVar"}',
                },
                query: '$interpolationVarWithPipe',
                spanName: '$interpolationVar',
                serviceName: '$interpolationVar',
                search: '$interpolationVar',
                minDuration: '$interpolationVar',
                maxDuration: '$interpolationVar',
                filters: [],
            };
        }
        let templateSrv;
        const text = 'interpolationText';
        const textWithPipe = 'interpolationTextOne|interpolationTextTwo';
        beforeEach(() => {
            templateSrv = initTemplateSrv('key', [
                {
                    type: 'custom',
                    name: 'interpolationVar',
                    current: { value: [text] },
                },
                {
                    type: 'custom',
                    name: 'interpolationVarWithPipe',
                    current: { value: [textWithPipe] },
                },
            ]);
        });
        it('when traceId query for dashboard->explore', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const ds = new TempoDatasource(defaultSettings, templateSrv);
            const queries = ds.interpolateVariablesInQueries([getQuery()], {});
            expect((_a = queries[0].linkedQuery) === null || _a === void 0 ? void 0 : _a.expr).toBe(`{instance=\"${text}\"}`);
            expect(queries[0].query).toBe(textWithPipe);
            expect(queries[0].serviceName).toBe(text);
            expect(queries[0].spanName).toBe(text);
            expect(queries[0].search).toBe(text);
            expect(queries[0].minDuration).toBe(text);
            expect(queries[0].maxDuration).toBe(text);
        }));
        it('when traceId query for template variable', () => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            const scopedText = 'scopedInterpolationText';
            const ds = new TempoDatasource(defaultSettings, templateSrv);
            const resp = ds.applyTemplateVariables(getQuery(), {
                interpolationVar: { text: scopedText, value: scopedText },
            });
            expect((_b = resp.linkedQuery) === null || _b === void 0 ? void 0 : _b.expr).toBe(`{instance=\"${scopedText}\"}`);
            expect(resp.query).toBe(textWithPipe);
            expect(resp.serviceName).toBe(scopedText);
            expect(resp.spanName).toBe(scopedText);
            expect(resp.search).toBe(scopedText);
            expect(resp.minDuration).toBe(scopedText);
            expect(resp.maxDuration).toBe(scopedText);
        }));
    });
    it('parses json fields from backend', () => __awaiter(void 0, void 0, void 0, function* () {
        setupBackendSrv(createDataFrame({
            fields: [
                { name: 'traceID', values: ['04450900759028499335'] },
                { name: 'spanID', values: ['4322526419282105830'] },
                { name: 'parentSpanID', values: [''] },
                { name: 'operationName', values: ['store.validateQueryTimeRange'] },
                { name: 'startTime', values: [1619712655875.4539] },
                { name: 'duration', values: [14.984] },
                { name: 'serviceTags', values: [{ key: 'servicetag1', value: 'service' }] },
                { name: 'logs', values: [{ timestamp: 12345, fields: [{ key: 'count', value: 1 }] }] },
                { name: 'tags', values: [{ key: 'tag1', value: 'val1' }] },
                { name: 'serviceName', values: ['service'] },
            ],
        }));
        const templateSrv = { replace: jest.fn() };
        const ds = new TempoDatasource(defaultSettings, templateSrv);
        const response = yield lastValueFrom(ds.query({ targets: [{ refId: 'refid1', query: '12345' }] }));
        expect(response.data[0].fields.map((f) => ({
            name: f.name,
            values: f.values,
        }))).toMatchObject([
            { name: 'traceID', values: ['04450900759028499335'] },
            { name: 'spanID', values: ['4322526419282105830'] },
            { name: 'parentSpanID', values: [''] },
            { name: 'operationName', values: ['store.validateQueryTimeRange'] },
            { name: 'startTime', values: [1619712655875.4539] },
            { name: 'duration', values: [14.984] },
            { name: 'serviceTags', values: [{ key: 'servicetag1', value: 'service' }] },
            { name: 'logs', values: [{ timestamp: 12345, fields: [{ key: 'count', value: 1 }] }] },
            { name: 'tags', values: [{ key: 'tag1', value: 'val1' }] },
            { name: 'serviceName', values: ['service'] },
        ]);
        expect(response.data[1].fields.map((f) => ({
            name: f.name,
            values: f.values,
        }))).toMatchObject([
            { name: 'id', values: ['4322526419282105830'] },
            { name: 'title', values: ['service'] },
            { name: 'subtitle', values: ['store.validateQueryTimeRange'] },
            { name: 'mainstat', values: ['14.98ms (100%)'] },
            { name: 'secondarystat', values: ['14.98ms (100%)'] },
            { name: 'color', values: [1.000007560204647] },
        ]);
        expect(response.data[2].fields.map((f) => ({
            name: f.name,
            values: f.values,
        }))).toMatchObject([
            { name: 'id', values: [] },
            { name: 'target', values: [] },
            { name: 'source', values: [] },
        ]);
    }));
    it('should handle json file upload', () => __awaiter(void 0, void 0, void 0, function* () {
        const ds = new TempoDatasource(defaultSettings);
        ds.uploadedJson = JSON.stringify(mockJson);
        const response = yield lastValueFrom(ds.query({
            targets: [{ queryType: 'upload', refId: 'A' }],
        }));
        const field = response.data[0].fields[0];
        expect(field.name).toBe('traceID');
        expect(field.type).toBe(FieldType.string);
        expect(field.values[0]).toBe('60ba2abb44f13eae');
        expect(field.values.length).toBe(6);
    }));
    it('should fail on invalid json file upload', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const ds = new TempoDatasource(defaultSettings);
        ds.uploadedJson = JSON.stringify(mockInvalidJson);
        const response = yield lastValueFrom(ds.query({
            targets: [{ queryType: 'upload', refId: 'A' }],
        }));
        expect((_a = response.error) === null || _a === void 0 ? void 0 : _a.message).toBeDefined();
        expect(response.data.length).toBe(0);
    }));
    it('should handle service graph upload', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b, _c;
        const ds = new TempoDatasource(defaultSettings);
        ds.uploadedJson = JSON.stringify(mockServiceGraph);
        const response = yield lastValueFrom(ds.query({
            targets: [{ queryType: 'upload', refId: 'A' }],
        }));
        expect(response.data).toHaveLength(2);
        const nodesFrame = response.data[0];
        expect(nodesFrame.name).toBe('Nodes');
        expect((_b = nodesFrame.meta) === null || _b === void 0 ? void 0 : _b.preferredVisualisationType).toBe('nodeGraph');
        const edgesFrame = response.data[1];
        expect(edgesFrame.name).toBe('Edges');
        expect((_c = edgesFrame.meta) === null || _c === void 0 ? void 0 : _c.preferredVisualisationType).toBe('nodeGraph');
    }));
    it('should build search query correctly', () => {
        const templateSrv = { replace: jest.fn() };
        const ds = new TempoDatasource(defaultSettings, templateSrv);
        const duration = '10ms';
        templateSrv.replace.mockReturnValue(duration);
        const tempoQuery = {
            queryType: 'search',
            refId: 'A',
            query: '',
            serviceName: 'frontend',
            spanName: '/config',
            search: 'root.http.status_code=500',
            minDuration: '$interpolationVar',
            maxDuration: '$interpolationVar',
            limit: 10,
            filters: [],
        };
        const builtQuery = ds.buildSearchQuery(tempoQuery);
        expect(builtQuery).toStrictEqual({
            tags: 'root.http.status_code=500 service.name="frontend" name="/config"',
            minDuration: duration,
            maxDuration: duration,
            limit: 10,
        });
    });
    it('should format metrics summary query correctly', () => {
        const ds = new TempoDatasource(defaultSettings, {});
        const queryGroupBy = [
            { id: '1', scope: TraceqlSearchScope.Unscoped, tag: 'component' },
            { id: '2', scope: TraceqlSearchScope.Span, tag: 'name' },
            { id: '3', scope: TraceqlSearchScope.Resource, tag: 'service.name' },
            { id: '4', scope: TraceqlSearchScope.Intrinsic, tag: 'kind' },
        ];
        const groupBy = ds.formatGroupBy(queryGroupBy);
        expect(groupBy).toEqual('.component, span.name, resource.service.name, kind');
    });
    it('should include a default limit', () => {
        const ds = new TempoDatasource(defaultSettings);
        const tempoQuery = {
            queryType: 'search',
            refId: 'A',
            query: '',
            search: '',
            filters: [],
        };
        const builtQuery = ds.buildSearchQuery(tempoQuery);
        expect(builtQuery).toStrictEqual({
            tags: '',
            limit: DEFAULT_LIMIT,
        });
    });
    it('should include time range if provided', () => {
        const ds = new TempoDatasource(defaultSettings);
        const tempoQuery = {
            queryType: 'search',
            refId: 'A',
            query: '',
            search: '',
            filters: [],
        };
        const timeRange = { startTime: 0, endTime: 1000 };
        const builtQuery = ds.buildSearchQuery(tempoQuery, timeRange);
        expect(builtQuery).toStrictEqual({
            tags: '',
            limit: DEFAULT_LIMIT,
            start: timeRange.startTime,
            end: timeRange.endTime,
        });
    });
    it('formats native search query history correctly', () => {
        const ds = new TempoDatasource(defaultSettings);
        const tempoQuery = {
            filters: [],
            queryType: 'nativeSearch',
            refId: 'A',
            query: '',
            serviceName: 'frontend',
            spanName: '/config',
            search: 'root.http.status_code=500',
            minDuration: '1ms',
            maxDuration: '100s',
            limit: 10,
        };
        const result = ds.getQueryDisplayText(tempoQuery);
        expect(result).toBe('Service Name: frontend, Span Name: /config, Search: root.http.status_code=500, Min Duration: 1ms, Max Duration: 100s, Limit: 10');
    });
    it('should get loki search datasource', () => {
        // 1. Get lokiSearch.datasource if present
        const ds1 = new TempoDatasource(Object.assign(Object.assign({}, defaultSettings), { jsonData: {
                lokiSearch: {
                    datasourceUid: 'loki-1',
                },
            } }));
        const lokiDS1 = ds1.getLokiSearchDS();
        expect(lokiDS1).toBe('loki-1');
        // 2. Get traceToLogs.datasource
        const ds2 = new TempoDatasource(Object.assign(Object.assign({}, defaultSettings), { jsonData: {
                tracesToLogs: {
                    lokiSearch: true,
                    datasourceUid: 'loki-2',
                },
            } }));
        const lokiDS2 = ds2.getLokiSearchDS();
        expect(lokiDS2).toBe('loki-2');
        // 3. Return undefined if neither is available
        const ds3 = new TempoDatasource(defaultSettings);
        const lokiDS3 = ds3.getLokiSearchDS();
        expect(lokiDS3).toBe(undefined);
        // 4. Return undefined if lokiSearch is undefined, even if traceToLogs is present
        // since this indicates the user cleared the fallback setting
        const ds4 = new TempoDatasource(Object.assign(Object.assign({}, defaultSettings), { jsonData: {
                tracesToLogs: {
                    lokiSearch: true,
                    datasourceUid: 'loki-2',
                },
                lokiSearch: {
                    datasourceUid: undefined,
                },
            } }));
        const lokiDS4 = ds4.getLokiSearchDS();
        expect(lokiDS4).toBe(undefined);
    });
    describe('test the testDatasource function', () => {
        it('should return a success msg if response.ok is true', () => __awaiter(void 0, void 0, void 0, function* () {
            mockObservable = () => of({ ok: true });
            const ds = new TempoDatasource(defaultSettings);
            const response = yield ds.testDatasource();
            expect(response.status).toBe('success');
        }));
    });
    describe('test the metadataRequest function', () => {
        it('should return the last value from the observed stream', () => __awaiter(void 0, void 0, void 0, function* () {
            mockObservable = () => of('321', '123', '456');
            const ds = new TempoDatasource(defaultSettings);
            const response = yield ds.metadataRequest('/api/search/tags');
            expect(response).toBe('456');
        }));
    });
    it('should include time shift when querying for traceID', () => {
        const ds = new TempoDatasource(Object.assign(Object.assign({}, defaultSettings), { jsonData: { traceQuery: { timeShiftEnabled: true, spanStartTimeShift: '2m', spanEndTimeShift: '4m' } } }));
        const request = ds.traceIdQueryRequest({
            requestId: 'test',
            interval: '',
            intervalMs: 5,
            scopedVars: {},
            targets: [],
            timezone: '',
            app: '',
            startTime: 0,
            range: {
                from: dateTime(new Date(2022, 8, 13, 16, 0, 0, 0)),
                to: dateTime(new Date(2022, 8, 13, 16, 15, 0, 0)),
                raw: { from: '15m', to: 'now' },
            },
        }, [{ refId: 'refid1', queryType: 'traceql', query: '' }]);
        expect(request.range.from.unix()).toBe(dateTime(new Date(2022, 8, 13, 15, 58, 0, 0)).unix());
        expect(request.range.to.unix()).toBe(dateTime(new Date(2022, 8, 13, 16, 19, 0, 0)).unix());
    });
    it('should not include time shift when querying for traceID and time shift config is off', () => {
        const ds = new TempoDatasource(Object.assign(Object.assign({}, defaultSettings), { jsonData: { traceQuery: { timeShiftEnabled: false, spanStartTimeShift: '2m', spanEndTimeShift: '4m' } } }));
        const request = ds.traceIdQueryRequest({
            requestId: 'test',
            interval: '',
            intervalMs: 5,
            scopedVars: {},
            targets: [],
            timezone: '',
            app: '',
            startTime: 0,
            range: {
                from: dateTime(new Date(2022, 8, 13, 16, 0, 0, 0)),
                to: dateTime(new Date(2022, 8, 13, 16, 15, 0, 0)),
                raw: { from: '15m', to: 'now' },
            },
        }, [{ refId: 'refid1', queryType: 'traceql', query: '' }]);
        expect(request.range.from.unix()).toBe(dateTime(0).unix());
        expect(request.range.to.unix()).toBe(dateTime(0).unix());
    });
});
describe('Tempo service graph view', () => {
    it('runs service graph queries', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77, _78, _79, _80, _81, _82, _83, _84, _85, _86, _87, _88;
        const ds = new TempoDatasource(Object.assign(Object.assign({}, defaultSettings), { jsonData: {
                serviceMap: {
                    datasourceUid: 'prom',
                },
            } }));
        setDataSourceSrv(backendSrvWithPrometheus);
        const response = yield lastValueFrom(ds.query({ targets: [{ queryType: 'serviceMap' }], range: getDefaultTimeRange(), app: CoreApp.Explore }));
        expect(response.data).toHaveLength(3);
        expect(response.state).toBe(LoadingState.Done);
        // Service Graph view
        expect(response.data[0].fields[0].name).toBe('Name');
        expect(response.data[0].fields[0].values.length).toBe(2);
        expect(response.data[0].fields[0].values[0]).toBe('HTTP Client');
        expect(response.data[0].fields[0].values[1]).toBe('HTTP GET - root');
        expect(response.data[0].fields[1].name).toBe('Rate');
        expect(response.data[0].fields[1].values.length).toBe(2);
        expect(response.data[0].fields[1].values[0]).toBe(12.75164671814457);
        expect(response.data[0].fields[1].values[1]).toBe(12.121331111401608);
        expect((_b = (_a = response.data[0].fields[1]) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.decimals).toBe(2);
        expect((_f = (_e = (_d = (_c = response.data[0].fields[1]) === null || _c === void 0 ? void 0 : _c.config) === null || _d === void 0 ? void 0 : _d.links) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.title).toBe('Rate');
        expect((_l = (_k = (_j = (_h = (_g = response.data[0].fields[1]) === null || _g === void 0 ? void 0 : _g.config) === null || _h === void 0 ? void 0 : _h.links) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.internal) === null || _l === void 0 ? void 0 : _l.query.expr).toBe('sum(rate(traces_spanmetrics_calls_total{span_name="${__data.fields[0]}"}[$__rate_interval]))');
        expect((_r = (_q = (_p = (_o = (_m = response.data[0].fields[1]) === null || _m === void 0 ? void 0 : _m.config) === null || _o === void 0 ? void 0 : _o.links) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.internal) === null || _r === void 0 ? void 0 : _r.query.range).toBe(true);
        expect((_w = (_v = (_u = (_t = (_s = response.data[0].fields[1]) === null || _s === void 0 ? void 0 : _s.config) === null || _t === void 0 ? void 0 : _t.links) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.internal) === null || _w === void 0 ? void 0 : _w.query.exemplar).toBe(true);
        expect((_1 = (_0 = (_z = (_y = (_x = response.data[0].fields[1]) === null || _x === void 0 ? void 0 : _x.config) === null || _y === void 0 ? void 0 : _y.links) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.internal) === null || _1 === void 0 ? void 0 : _1.query.instant).toBe(false);
        expect(response.data[0].fields[2].values.length).toBe(2);
        expect(response.data[0].fields[2].values[0]).toBe(12.75164671814457);
        expect(response.data[0].fields[2].values[1]).toBe(12.121331111401608);
        expect((_4 = (_3 = (_2 = response.data[0].fields[2]) === null || _2 === void 0 ? void 0 : _2.config) === null || _3 === void 0 ? void 0 : _3.color) === null || _4 === void 0 ? void 0 : _4.mode).toBe('continuous-BlPu');
        expect((_6 = (_5 = response.data[0].fields[2]) === null || _5 === void 0 ? void 0 : _5.config) === null || _6 === void 0 ? void 0 : _6.custom.cellOptions.mode).toBe(BarGaugeDisplayMode.Lcd);
        expect((_8 = (_7 = response.data[0].fields[2]) === null || _7 === void 0 ? void 0 : _7.config) === null || _8 === void 0 ? void 0 : _8.custom.cellOptions.type).toBe(TableCellDisplayMode.Gauge);
        expect((_10 = (_9 = response.data[0].fields[2]) === null || _9 === void 0 ? void 0 : _9.config) === null || _10 === void 0 ? void 0 : _10.decimals).toBe(3);
        expect(response.data[0].fields[3].name).toBe('Error Rate');
        expect(response.data[0].fields[3].values.length).toBe(2);
        expect(response.data[0].fields[3].values[0]).toBe(3.75164671814457);
        expect(response.data[0].fields[3].values[1]).toBe(3.121331111401608);
        expect((_12 = (_11 = response.data[0].fields[3]) === null || _11 === void 0 ? void 0 : _11.config) === null || _12 === void 0 ? void 0 : _12.decimals).toBe(2);
        expect((_16 = (_15 = (_14 = (_13 = response.data[0].fields[3]) === null || _13 === void 0 ? void 0 : _13.config) === null || _14 === void 0 ? void 0 : _14.links) === null || _15 === void 0 ? void 0 : _15[0]) === null || _16 === void 0 ? void 0 : _16.title).toBe('Error Rate');
        expect((_21 = (_20 = (_19 = (_18 = (_17 = response.data[0].fields[3]) === null || _17 === void 0 ? void 0 : _17.config) === null || _18 === void 0 ? void 0 : _18.links) === null || _19 === void 0 ? void 0 : _19[0]) === null || _20 === void 0 ? void 0 : _20.internal) === null || _21 === void 0 ? void 0 : _21.query.expr).toBe('sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR",span_name="${__data.fields[0]}"}[$__rate_interval]))');
        expect((_26 = (_25 = (_24 = (_23 = (_22 = response.data[0].fields[3]) === null || _22 === void 0 ? void 0 : _22.config) === null || _23 === void 0 ? void 0 : _23.links) === null || _24 === void 0 ? void 0 : _24[0]) === null || _25 === void 0 ? void 0 : _25.internal) === null || _26 === void 0 ? void 0 : _26.query.range).toBe(true);
        expect((_31 = (_30 = (_29 = (_28 = (_27 = response.data[0].fields[3]) === null || _27 === void 0 ? void 0 : _27.config) === null || _28 === void 0 ? void 0 : _28.links) === null || _29 === void 0 ? void 0 : _29[0]) === null || _30 === void 0 ? void 0 : _30.internal) === null || _31 === void 0 ? void 0 : _31.query.exemplar).toBe(true);
        expect((_36 = (_35 = (_34 = (_33 = (_32 = response.data[0].fields[3]) === null || _32 === void 0 ? void 0 : _32.config) === null || _33 === void 0 ? void 0 : _33.links) === null || _34 === void 0 ? void 0 : _34[0]) === null || _35 === void 0 ? void 0 : _35.internal) === null || _36 === void 0 ? void 0 : _36.query.instant).toBe(false);
        expect(response.data[0].fields[4].values.length).toBe(2);
        expect(response.data[0].fields[4].values[0]).toBe(3.75164671814457);
        expect(response.data[0].fields[4].values[1]).toBe(3.121331111401608);
        expect((_39 = (_38 = (_37 = response.data[0].fields[4]) === null || _37 === void 0 ? void 0 : _37.config) === null || _38 === void 0 ? void 0 : _38.color) === null || _39 === void 0 ? void 0 : _39.mode).toBe('continuous-RdYlGr');
        expect((_41 = (_40 = response.data[0].fields[4]) === null || _40 === void 0 ? void 0 : _40.config) === null || _41 === void 0 ? void 0 : _41.custom.cellOptions.mode).toBe(BarGaugeDisplayMode.Lcd);
        expect((_43 = (_42 = response.data[0].fields[4]) === null || _42 === void 0 ? void 0 : _42.config) === null || _43 === void 0 ? void 0 : _43.custom.cellOptions.type).toBe(TableCellDisplayMode.Gauge);
        expect((_45 = (_44 = response.data[0].fields[4]) === null || _44 === void 0 ? void 0 : _44.config) === null || _45 === void 0 ? void 0 : _45.decimals).toBe(3);
        expect(response.data[0].fields[5].name).toBe('Duration (p90)');
        expect(response.data[0].fields[5].values.length).toBe(2);
        expect(response.data[0].fields[5].values[0]).toBe('0');
        expect(response.data[0].fields[5].values[1]).toBe(0.12003505696757232);
        expect((_47 = (_46 = response.data[0].fields[5]) === null || _46 === void 0 ? void 0 : _46.config) === null || _47 === void 0 ? void 0 : _47.unit).toBe('s');
        expect((_51 = (_50 = (_49 = (_48 = response.data[0].fields[5]) === null || _48 === void 0 ? void 0 : _48.config) === null || _49 === void 0 ? void 0 : _49.links) === null || _50 === void 0 ? void 0 : _50[0]) === null || _51 === void 0 ? void 0 : _51.title).toBe('Duration');
        expect((_56 = (_55 = (_54 = (_53 = (_52 = response.data[0].fields[5]) === null || _52 === void 0 ? void 0 : _52.config) === null || _53 === void 0 ? void 0 : _53.links) === null || _54 === void 0 ? void 0 : _54[0]) === null || _55 === void 0 ? void 0 : _55.internal) === null || _56 === void 0 ? void 0 : _56.query.expr).toBe('histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{span_name="${__data.fields[0]}"}[$__rate_interval])) by (le))');
        expect((_61 = (_60 = (_59 = (_58 = (_57 = response.data[0].fields[5]) === null || _57 === void 0 ? void 0 : _57.config) === null || _58 === void 0 ? void 0 : _58.links) === null || _59 === void 0 ? void 0 : _59[0]) === null || _60 === void 0 ? void 0 : _60.internal) === null || _61 === void 0 ? void 0 : _61.query.range).toBe(true);
        expect((_66 = (_65 = (_64 = (_63 = (_62 = response.data[0].fields[5]) === null || _62 === void 0 ? void 0 : _62.config) === null || _63 === void 0 ? void 0 : _63.links) === null || _64 === void 0 ? void 0 : _64[0]) === null || _65 === void 0 ? void 0 : _65.internal) === null || _66 === void 0 ? void 0 : _66.query.exemplar).toBe(true);
        expect((_71 = (_70 = (_69 = (_68 = (_67 = response.data[0].fields[5]) === null || _67 === void 0 ? void 0 : _67.config) === null || _68 === void 0 ? void 0 : _68.links) === null || _69 === void 0 ? void 0 : _69[0]) === null || _70 === void 0 ? void 0 : _70.internal) === null || _71 === void 0 ? void 0 : _71.query.instant).toBe(false);
        expect((_74 = (_73 = (_72 = response.data[0].fields[6]) === null || _72 === void 0 ? void 0 : _72.config) === null || _73 === void 0 ? void 0 : _73.links) === null || _74 === void 0 ? void 0 : _74[0].url).toBe('');
        expect((_77 = (_76 = (_75 = response.data[0].fields[6]) === null || _75 === void 0 ? void 0 : _75.config) === null || _76 === void 0 ? void 0 : _76.links) === null || _77 === void 0 ? void 0 : _77[0].title).toBe('Tempo');
        expect((_80 = (_79 = (_78 = response.data[0].fields[6]) === null || _78 === void 0 ? void 0 : _78.config) === null || _79 === void 0 ? void 0 : _79.links) === null || _80 === void 0 ? void 0 : _80[0].internal.query.queryType).toBe('traceqlSearch');
        expect((_83 = (_82 = (_81 = response.data[0].fields[6]) === null || _81 === void 0 ? void 0 : _81.config) === null || _82 === void 0 ? void 0 : _82.links) === null || _83 === void 0 ? void 0 : _83[0].internal.query.filters[0].value).toBe('${__data.fields[0]}');
        // Service graph
        expect(response.data[1].name).toBe('Nodes');
        expect(response.data[1].fields[0].values.length).toBe(3);
        expect((_86 = (_85 = (_84 = response.data[1].fields[0]) === null || _84 === void 0 ? void 0 : _84.config) === null || _85 === void 0 ? void 0 : _85.links) === null || _86 === void 0 ? void 0 : _86.length).toBeGreaterThan(0);
        expect((_88 = (_87 = response.data[1].fields[0]) === null || _87 === void 0 ? void 0 : _87.config) === null || _88 === void 0 ? void 0 : _88.links).toEqual(serviceGraphLinks);
        expect(response.data[2].name).toBe('Edges');
        expect(response.data[2].fields[0].values.length).toBe(2);
    }));
    it('should build expr correctly', () => {
        let targets = { targets: [{ queryType: 'serviceMap' }] };
        let builtQuery = buildExpr({ expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))', params: [] }, '', targets);
        expect(builtQuery).toBe('topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))');
        builtQuery = buildExpr({
            expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))',
            params: ['status_code="STATUS_CODE_ERROR"'],
        }, 'span_name=~"HTTP Client|HTTP GET|HTTP GET - root|HTTP POST|HTTP POST - post"', targets);
        expect(builtQuery).toBe('topk(5, sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR",span_name=~"HTTP Client|HTTP GET|HTTP GET - root|HTTP POST|HTTP POST - post"}[$__range])) by (span_name))');
        builtQuery = buildExpr({
            expr: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{}[$__range])) by (le))',
            params: ['status_code="STATUS_CODE_ERROR"'],
        }, 'span_name=~"HTTP Client"', targets);
        expect(builtQuery).toBe('histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{status_code="STATUS_CODE_ERROR",span_name=~"HTTP Client"}[$__range])) by (le))');
        targets = { targets: [{ queryType: 'serviceMap', serviceMapQuery: '{client="app",service="app"}' }] };
        builtQuery = buildExpr({ expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))', params: [] }, '', targets);
        expect(builtQuery).toBe('topk(5, sum(rate(traces_spanmetrics_calls_total{service="app",service="app"}[$__range])) by (span_name))');
        targets = { targets: [{ queryType: 'serviceMap', serviceMapQuery: '{client="${app}",service="$app"}' }] };
        builtQuery = buildExpr({ expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))', params: [] }, '', targets);
        expect(builtQuery).toBe('topk(5, sum(rate(traces_spanmetrics_calls_total{service="${app}",service="$app"}[$__range])) by (span_name))');
    });
    it('should build link expr correctly', () => {
        let builtQuery = buildLinkExpr('topk(5, sum(rate(traces_spanmetrics_calls_total{}[$__range])) by (span_name))');
        expect(builtQuery).toBe('sum(rate(traces_spanmetrics_calls_total{}[$__rate_interval]))');
    });
    it('should escape span names correctly', () => {
        const spanNames = [
            '/actuator/health/**',
            '$type + [test]|HTTP POST - post',
            'server.cluster.local:9090^/sample.test(.*)?',
        ];
        let escaped = getEscapedSpanNames(spanNames);
        expect(escaped).toEqual([
            '/actuator/health/\\\\*\\\\*',
            '\\\\$type \\\\+ \\\\[test\\\\]\\\\|HTTP POST - post',
            'server\\\\.cluster\\\\.local:9090\\\\^/sample\\\\.test\\\\(\\\\.\\\\*\\\\)\\\\?',
        ]);
    });
    it('should get field config correctly', () => {
        let datasourceUid = 's4Jvz8Qnk';
        let tempoDatasourceUid = 'EbPO1fYnz';
        let targetField = '__data.fields.target';
        let tempoField = '__data.fields.target';
        let sourceField = '__data.fields.source';
        let fieldConfig = getFieldConfig(datasourceUid, tempoDatasourceUid, targetField, tempoField, sourceField);
        let resultObj = {
            links: [
                {
                    url: '',
                    title: 'Request rate',
                    internal: {
                        query: {
                            expr: 'sum by (client, server)(rate(traces_service_graph_request_total{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval]))',
                            range: true,
                            exemplar: true,
                            instant: false,
                        },
                        datasourceUid: 's4Jvz8Qnk',
                        datasourceName: '',
                    },
                },
                {
                    url: '',
                    title: 'Request histogram',
                    internal: {
                        query: {
                            expr: 'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds_bucket{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval])) by (le, client, server))',
                            range: true,
                            exemplar: true,
                            instant: false,
                        },
                        datasourceUid: 's4Jvz8Qnk',
                        datasourceName: '',
                    },
                },
                {
                    url: '',
                    title: 'Failed request rate',
                    internal: {
                        query: {
                            expr: 'sum by (client, server)(rate(traces_service_graph_request_failed_total{client="${__data.fields.source}",server="${__data.fields.target}"}[$__rate_interval]))',
                            range: true,
                            exemplar: true,
                            instant: false,
                        },
                        datasourceUid: 's4Jvz8Qnk',
                        datasourceName: '',
                    },
                },
                {
                    url: '',
                    title: 'View traces',
                    internal: {
                        query: {
                            refId: 'A',
                            queryType: 'traceqlSearch',
                            filters: [
                                {
                                    id: 'service-name',
                                    operator: '=',
                                    scope: 'resource',
                                    tag: 'service.name',
                                    value: '${__data.fields.target}',
                                    valueType: 'string',
                                },
                            ],
                        },
                        datasourceUid: 'EbPO1fYnz',
                        datasourceName: '',
                    },
                },
            ],
        };
        expect(fieldConfig).toStrictEqual(resultObj);
    });
    it('should get field config correctly when namespaces are present', () => {
        let datasourceUid = 's4Jvz8Qnk';
        let tempoDatasourceUid = 'EbPO1fYnz';
        let targetField = '__data.fields.targetName';
        let tempoField = '__data.fields.target';
        let sourceField = '__data.fields.sourceName';
        let namespaceFields = {
            targetNamespace: '__data.fields.targetNamespace',
            sourceNamespace: '__data.fields.sourceNamespace',
        };
        let fieldConfig = getFieldConfig(datasourceUid, tempoDatasourceUid, targetField, tempoField, sourceField, namespaceFields);
        let resultObj = {
            links: [
                {
                    url: '',
                    title: 'Request rate',
                    internal: {
                        query: {
                            expr: 'sum by (client, server, server_service_namespace, client_service_namespace)(rate(traces_service_graph_request_total{client="${__data.fields.sourceName}",client_service_namespace="${__data.fields.sourceNamespace}",server="${__data.fields.targetName}",server_service_namespace="${__data.fields.targetNamespace}"}[$__rate_interval]))',
                            range: true,
                            exemplar: true,
                            instant: false,
                        },
                        datasourceUid: 's4Jvz8Qnk',
                        datasourceName: '',
                    },
                },
                {
                    url: '',
                    title: 'Request histogram',
                    internal: {
                        query: {
                            expr: 'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds_bucket{client="${__data.fields.sourceName}",client_service_namespace="${__data.fields.sourceNamespace}",server="${__data.fields.targetName}",server_service_namespace="${__data.fields.targetNamespace}"}[$__rate_interval])) by (le, client, server, server_service_namespace, client_service_namespace))',
                            range: true,
                            exemplar: true,
                            instant: false,
                        },
                        datasourceUid: 's4Jvz8Qnk',
                        datasourceName: '',
                    },
                },
                {
                    url: '',
                    title: 'Failed request rate',
                    internal: {
                        query: {
                            expr: 'sum by (client, server, server_service_namespace, client_service_namespace)(rate(traces_service_graph_request_failed_total{client="${__data.fields.sourceName}",client_service_namespace="${__data.fields.sourceNamespace}",server="${__data.fields.targetName}",server_service_namespace="${__data.fields.targetNamespace}"}[$__rate_interval]))',
                            range: true,
                            exemplar: true,
                            instant: false,
                        },
                        datasourceUid: 's4Jvz8Qnk',
                        datasourceName: '',
                    },
                },
                {
                    url: '',
                    title: 'View traces',
                    internal: {
                        query: {
                            queryType: 'traceqlSearch',
                            refId: 'A',
                            filters: [
                                {
                                    id: 'service-name',
                                    operator: '=',
                                    scope: 'resource',
                                    tag: 'service.name',
                                    value: '${__data.fields.target}',
                                    valueType: 'string',
                                },
                            ],
                        },
                        datasourceUid: 'EbPO1fYnz',
                        datasourceName: '',
                    },
                },
            ],
        };
        expect(fieldConfig).toStrictEqual(resultObj);
    });
    it('should get rate aligned values correctly', () => {
        const resp = [
            {
                refId: 'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app",service="app"}[$__range])) by (span_name))',
                fields: [
                    {
                        name: 'Time',
                        type: FieldType.time,
                        config: {},
                        values: [1653828275000, 1653828275000, 1653828275000, 1653828275000, 1653828275000],
                    },
                    {
                        name: 'span_name',
                        config: {
                            filterable: true,
                        },
                        type: FieldType.string,
                        values: ['HTTP Client', 'HTTP GET', 'HTTP GET - root', 'HTTP POST', 'HTTP POST - post'],
                    },
                ],
                values: [],
            },
        ];
        const objToAlign = {
            'HTTP GET - root': {
                value: '0.1234',
            },
            'HTTP GET': {
                value: '0.6789',
            },
            'HTTP POST - post': {
                value: '0.4321',
            },
        };
        let value = getRateAlignedValues(resp, objToAlign);
        expect(value.toString()).toBe('0,0.6789,0.1234,0,0.4321');
    });
    it('should make service graph view request correctly', () => {
        const request = makeServiceGraphViewRequest([
            'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app"}[$__range])) by (span_name))"',
            'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{status_code="STATUS_CODE_ERROR",service="app",service="app",span_name=~"HTTP Client"}[$__range])) by (le))',
        ]);
        expect(request).toEqual([
            {
                refId: 'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app"}[$__range])) by (span_name))"',
                expr: 'topk(5, sum(rate(traces_spanmetrics_calls_total{service="app"}[$__range])) by (span_name))"',
                instant: true,
            },
            {
                refId: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{status_code="STATUS_CODE_ERROR",service="app",service="app",span_name=~"HTTP Client"}[$__range])) by (le))',
                expr: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{status_code="STATUS_CODE_ERROR",service="app",service="app",span_name=~"HTTP Client"}[$__range])) by (le))',
                instant: true,
            },
        ]);
    });
    it('should make tempo link correctly', () => {
        const tempoLink = makeTempoLink('Tempo', '', '"${__data.fields[0]}"', 'gdev-tempo');
        expect(tempoLink).toEqual({
            url: '',
            title: 'Tempo',
            internal: {
                query: {
                    queryType: 'traceqlSearch',
                    refId: 'A',
                    filters: [
                        {
                            id: 'span-name',
                            operator: '=',
                            scope: 'span',
                            tag: 'name',
                            value: '"${__data.fields[0]}"',
                            valueType: 'string',
                        },
                    ],
                },
                datasourceUid: 'gdev-tempo',
                datasourceName: 'Tempo',
            },
        });
    });
});
describe('label names - v2 tags', () => {
    let datasource;
    beforeEach(() => {
        datasource = createTempoDatasource();
        jest.spyOn(datasource, 'metadataRequest').mockImplementation(createMetadataRequest({
            data: {
                scopes: [{ name: 'span', tags: ['label1', 'label2'] }],
            },
        }));
    });
    it('get label names', () => __awaiter(void 0, void 0, void 0, function* () {
        // label_names()
        const response = yield datasource.executeVariableQuery({ refId: 'test', type: TempoVariableQueryType.LabelNames });
        expect(response).toEqual([{ text: 'label1' }, { text: 'label2' }]);
    }));
});
describe('label names - v1 tags', () => {
    let datasource;
    beforeEach(() => {
        datasource = createTempoDatasource();
        jest
            .spyOn(datasource, 'metadataRequest')
            .mockImplementationOnce(() => {
            throw Error;
        })
            .mockImplementation(createMetadataRequest({
            data: {
                tagNames: ['label1', 'label2'],
            },
        }));
    });
    it('get label names', () => __awaiter(void 0, void 0, void 0, function* () {
        // label_names()
        const response = yield datasource.executeVariableQuery({ refId: 'test', type: TempoVariableQueryType.LabelNames });
        expect(response).toEqual([{ text: 'label1' }, { text: 'label2' }, { text: 'status.code' }]);
    }));
});
describe('label values', () => {
    let datasource;
    beforeEach(() => {
        datasource = createTempoDatasource();
        jest.spyOn(datasource, 'metadataRequest').mockImplementation(createMetadataRequest({
            data: {
                tagValues: [
                    {
                        type: 'value1',
                        value: 'value1',
                        label: 'value1',
                    },
                    {
                        type: 'value2',
                        value: 'value2',
                        label: 'value2',
                    },
                ],
            },
        }));
    });
    it('get label values for given label', () => __awaiter(void 0, void 0, void 0, function* () {
        // label_values("label")
        const response = yield datasource.executeVariableQuery({
            refId: 'test',
            type: TempoVariableQueryType.LabelValues,
            label: 'label',
        });
        expect(response).toEqual([
            { text: { type: 'value1', value: 'value1', label: 'value1' } },
            { text: { type: 'value2', value: 'value2', label: 'value2' } },
        ]);
    }));
    it('do not raise error when label is not set', () => __awaiter(void 0, void 0, void 0, function* () {
        // label_values()
        const response = yield datasource.executeVariableQuery({
            refId: 'test',
            type: TempoVariableQueryType.LabelValues,
            label: undefined,
        });
        expect(response).toEqual([]);
    }));
});
const backendSrvWithPrometheus = {
    get(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (uid === 'prom') {
                return {
                    query() {
                        return of({
                            data: [
                                rateMetric,
                                errorRateMetric,
                                durationMetric,
                                emptyDurationMetric,
                                totalsPromMetric,
                                secondsPromMetric,
                                failedPromMetric,
                            ],
                        });
                    },
                };
            }
            throw new Error('unexpected uid');
        });
    },
    getDataSourceSettingsByUid(uid) {
        if (uid === 'prom') {
            return { name: 'Prometheus' };
        }
        else if (uid === 'gdev-tempo') {
            return { name: 'Tempo' };
        }
        return '';
    },
};
function setupBackendSrv(frame) {
    setBackendSrv({
        fetch() {
            return of(createFetchResponse({
                results: {
                    refid1: {
                        frames: [dataFrameToJSON(frame)],
                    },
                },
            }));
        },
    });
}
export const defaultSettings = {
    id: 0,
    uid: 'gdev-tempo',
    type: 'tracing',
    name: 'tempo',
    access: 'proxy',
    meta: {
        id: 'tempo',
        name: 'tempo',
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
const rateMetric = createDataFrame({
    refId: 'topk(5, sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[$__range])) by (span_name))',
    fields: [
        { name: 'Time', values: [1653725618609, 1653725618609] },
        { name: 'span_name', values: ['HTTP Client', 'HTTP GET - root'] },
        {
            name: 'Value #topk(5, sum(rate(traces_spanmetrics_calls_total{span_kind="SPAN_KIND_SERVER"}[$__range])) by (span_name))',
            values: [12.75164671814457, 12.121331111401608],
        },
    ],
});
const errorRateMetric = createDataFrame({
    refId: 'topk(5, sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR",span_name=~"HTTP Client|HTTP GET - root"}[$__range])) by (span_name))',
    fields: [
        { name: 'Time', values: [1653725618609, 1653725618609] },
        { name: 'span_name', values: ['HTTP Client', 'HTTP GET - root'] },
        {
            name: 'Value #topk(5, sum(rate(traces_spanmetrics_calls_total{status_code="STATUS_CODE_ERROR"}[$__range])) by (span_name))',
            values: [3.75164671814457, 3.121331111401608],
        },
    ],
});
const durationMetric = createDataFrame({
    refId: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{span_name=~"HTTP GET - root"}[$__range])) by (le))',
    fields: [
        { name: 'Time', values: [1653725618609] },
        {
            name: 'Value #histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{span_name=~"HTTP GET - root"}[$__range])) by (le))',
            values: [0.12003505696757232],
        },
    ],
});
const emptyDurationMetric = createDataFrame({
    refId: 'histogram_quantile(.9, sum(rate(traces_spanmetrics_latency_bucket{span_name=~"HTTP GET - root"}[$__range])) by (le))',
    fields: [],
});
const totalsPromMetric = createDataFrame({
    refId: 'traces_service_graph_request_total',
    fields: [
        { name: 'Time', values: [1628169788000, 1628169788000] },
        { name: 'client', values: ['app', 'lb'] },
        { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
        { name: 'job', values: ['local_scrape', 'local_scrape'] },
        { name: 'server', values: ['db', 'app'] },
        { name: 'tempo_config', values: ['default', 'default'] },
        { name: 'Value #traces_service_graph_request_total', values: [10, 20] },
    ],
});
const secondsPromMetric = createDataFrame({
    refId: 'traces_service_graph_request_server_seconds_sum',
    fields: [
        { name: 'Time', values: [1628169788000, 1628169788000] },
        { name: 'client', values: ['app', 'lb'] },
        { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
        { name: 'job', values: ['local_scrape', 'local_scrape'] },
        { name: 'server', values: ['db', 'app'] },
        { name: 'tempo_config', values: ['default', 'default'] },
        { name: 'Value #traces_service_graph_request_server_seconds_sum', values: [10, 40] },
    ],
});
const failedPromMetric = createDataFrame({
    refId: 'traces_service_graph_request_failed_total',
    fields: [
        { name: 'Time', values: [1628169788000, 1628169788000] },
        { name: 'client', values: ['app', 'lb'] },
        { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
        { name: 'job', values: ['local_scrape', 'local_scrape'] },
        { name: 'server', values: ['db', 'app'] },
        { name: 'tempo_config', values: ['default', 'default'] },
        { name: 'Value #traces_service_graph_request_failed_total', values: [2, 15] },
    ],
});
const mockInvalidJson = {
    batches: [
        {
            resource: {
                attributes: [],
            },
            instrumentation_library_spans: [
                {
                    instrumentation_library: {},
                    spans: [
                        {
                            trace_id: 'AAAAAAAAAABguiq7RPE+rg==',
                            span_id: 'cmteMBAvwNA=',
                            parentSpanId: 'OY8PIaPbma4=',
                            name: 'HTTP GET - root',
                            kind: 'SPAN_KIND_SERVER',
                            startTimeUnixNano: '1627471657255809000',
                            endTimeUnixNano: '1627471657256268000',
                            attributes: [
                                { key: 'http.status_code', value: { intValue: '200' } },
                                { key: 'http.method', value: { stringValue: 'GET' } },
                                { key: 'http.url', value: { stringValue: '/' } },
                                { key: 'component', value: { stringValue: 'net/http' } },
                            ],
                            status: {},
                        },
                    ],
                },
            ],
        },
    ],
};
const serviceGraphLinks = [
    {
        url: '',
        title: 'Request rate',
        internal: {
            query: {
                expr: 'sum by (client, server)(rate(traces_service_graph_request_total{server="${__data.fields.id}"}[$__rate_interval]))',
                instant: false,
                range: true,
                exemplar: true,
            },
            datasourceUid: 'prom',
            datasourceName: 'Prometheus',
        },
    },
    {
        url: '',
        title: 'Request histogram',
        internal: {
            query: {
                expr: 'histogram_quantile(0.9, sum(rate(traces_service_graph_request_server_seconds_bucket{server="${__data.fields.id}"}[$__rate_interval])) by (le, client, server))',
                instant: false,
                range: true,
                exemplar: true,
            },
            datasourceUid: 'prom',
            datasourceName: 'Prometheus',
        },
    },
    {
        url: '',
        title: 'Failed request rate',
        internal: {
            query: {
                expr: 'sum by (client, server)(rate(traces_service_graph_request_failed_total{server="${__data.fields.id}"}[$__rate_interval]))',
                instant: false,
                range: true,
                exemplar: true,
            },
            datasourceUid: 'prom',
            datasourceName: 'Prometheus',
        },
    },
    {
        url: '',
        title: 'View traces',
        internal: {
            query: {
                refId: 'A',
                queryType: 'traceqlSearch',
                filters: [
                    {
                        id: 'service-name',
                        operator: '=',
                        scope: 'resource',
                        tag: 'service.name',
                        value: '${__data.fields[0]}',
                        valueType: 'string',
                    },
                ],
            },
            datasourceUid: 'gdev-tempo',
            datasourceName: 'Tempo',
        },
    },
];
//# sourceMappingURL=datasource.test.js.map