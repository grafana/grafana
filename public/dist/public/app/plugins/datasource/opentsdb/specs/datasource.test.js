import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { dateTime } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { createFetchResponse } from '../../../../../test/helpers/createFetchResponse';
import OpenTsDatasource from '../datasource';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
const metricFindQueryData = [
    {
        target: 'prod1.count',
        datapoints: [
            [10, 1],
            [12, 1],
        ],
    },
];
describe('opentsdb', () => {
    function getTestcontext({ data = metricFindQueryData } = {}) {
        jest.clearAllMocks();
        const fetchMock = jest.spyOn(backendSrv, 'fetch');
        fetchMock.mockImplementation(() => of(createFetchResponse(data)));
        const instanceSettings = { url: '', jsonData: { tsdbVersion: 1 } };
        const replace = jest.fn((value) => value);
        const templateSrv = {
            replace,
        };
        const ds = new OpenTsDatasource(instanceSettings, templateSrv);
        return { ds, templateSrv, fetchMock };
    }
    describe('When performing metricFindQuery', () => {
        it('metrics() should generate api suggest query', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const { ds, fetchMock } = getTestcontext();
            const results = yield ds.metricFindQuery('metrics(pew)');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
            expect((_a = fetchMock.mock.calls[0][0].params) === null || _a === void 0 ? void 0 : _a.type).toBe('metrics');
            expect((_b = fetchMock.mock.calls[0][0].params) === null || _b === void 0 ? void 0 : _b.q).toBe('pew');
            expect(results).not.toBe(null);
        }));
        it('tag_names(cpu) should generate lookup query', () => __awaiter(void 0, void 0, void 0, function* () {
            var _c;
            const { ds, fetchMock } = getTestcontext();
            const results = yield ds.metricFindQuery('tag_names(cpu)');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
            expect((_c = fetchMock.mock.calls[0][0].params) === null || _c === void 0 ? void 0 : _c.m).toBe('cpu');
            expect(results).not.toBe(null);
        }));
        it('tag_values(cpu, test) should generate lookup query', () => __awaiter(void 0, void 0, void 0, function* () {
            var _d;
            const { ds, fetchMock } = getTestcontext();
            const results = yield ds.metricFindQuery('tag_values(cpu, hostname)');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
            expect((_d = fetchMock.mock.calls[0][0].params) === null || _d === void 0 ? void 0 : _d.m).toBe('cpu{hostname=*}');
            expect(results).not.toBe(null);
        }));
        it('tag_values(cpu, test) should generate lookup query', () => __awaiter(void 0, void 0, void 0, function* () {
            var _e;
            const { ds, fetchMock } = getTestcontext();
            const results = yield ds.metricFindQuery('tag_values(cpu, hostname, env=$env)');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
            expect((_e = fetchMock.mock.calls[0][0].params) === null || _e === void 0 ? void 0 : _e.m).toBe('cpu{hostname=*,env=$env}');
            expect(results).not.toBe(null);
        }));
        it('tag_values(cpu, test) should generate lookup query', () => __awaiter(void 0, void 0, void 0, function* () {
            var _f;
            const { ds, fetchMock } = getTestcontext();
            const results = yield ds.metricFindQuery('tag_values(cpu, hostname, env=$env, region=$region)');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].url).toBe('/api/search/lookup');
            expect((_f = fetchMock.mock.calls[0][0].params) === null || _f === void 0 ? void 0 : _f.m).toBe('cpu{hostname=*,env=$env,region=$region}');
            expect(results).not.toBe(null);
        }));
        it('suggest_tagk() should generate api suggest query', () => __awaiter(void 0, void 0, void 0, function* () {
            var _g, _h;
            const { ds, fetchMock } = getTestcontext();
            const results = yield ds.metricFindQuery('suggest_tagk(foo)');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
            expect((_g = fetchMock.mock.calls[0][0].params) === null || _g === void 0 ? void 0 : _g.type).toBe('tagk');
            expect((_h = fetchMock.mock.calls[0][0].params) === null || _h === void 0 ? void 0 : _h.q).toBe('foo');
            expect(results).not.toBe(null);
        }));
        it('suggest_tagv() should generate api suggest query', () => __awaiter(void 0, void 0, void 0, function* () {
            var _j, _k;
            const { ds, fetchMock } = getTestcontext();
            const results = yield ds.metricFindQuery('suggest_tagv(bar)');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0].url).toBe('/api/suggest');
            expect((_j = fetchMock.mock.calls[0][0].params) === null || _j === void 0 ? void 0 : _j.type).toBe('tagv');
            expect((_k = fetchMock.mock.calls[0][0].params) === null || _k === void 0 ? void 0 : _k.q).toBe('bar');
            expect(results).not.toBe(null);
        }));
    });
    describe('When interpolating variables', () => {
        it('should return an empty array if no queries are provided', () => {
            const { ds } = getTestcontext();
            expect(ds.interpolateVariablesInQueries([], {})).toHaveLength(0);
        });
        it('should replace metric and filter variable', () => {
            const { ds, templateSrv } = getTestcontext();
            const logQuery = {
                refId: 'someRefId',
                metric: '$someVar',
                filters: [
                    {
                        type: 'type',
                        tagk: '$someTagk',
                        filter: '$someTagv',
                        groupBy: true,
                    },
                ],
            };
            ds.interpolateVariablesInQueries([logQuery], {});
            expect(templateSrv.replace).toHaveBeenCalledWith('$someVar', {}, 'pipe');
            expect(templateSrv.replace).toHaveBeenCalledWith('$someTagk', {}, 'pipe');
            expect(templateSrv.replace).toHaveBeenCalledWith('$someTagv', {}, 'pipe');
            expect(templateSrv.replace).toHaveBeenCalledTimes(3);
        });
        it('should replace filter tag key and value', () => {
            const { ds, templateSrv } = getTestcontext();
            let logQuery = {
                refId: 'A',
                datasource: {
                    type: 'opentsdb',
                    uid: 'P311D5F9D9B165031',
                },
                aggregator: 'sum',
                downsampleAggregator: 'avg',
                downsampleFillPolicy: 'none',
                metric: 'logins.count',
                filters: [
                    {
                        type: 'iliteral_or',
                        tagk: '$someTagk',
                        filter: '$someTagv',
                        groupBy: false,
                    },
                ],
            };
            const scopedVars = {
                __interval: {
                    text: '20s',
                    value: '20s',
                },
                __interval_ms: {
                    text: '20000',
                    value: 20000,
                },
            };
            const dataQR = {
                app: 'dashboard',
                requestId: 'Q103',
                timezone: 'browser',
                panelId: 2,
                dashboardUID: 'tyzmfPIVz',
                range: {
                    from: dateTime('2022-10-19T08:55:18.430Z'),
                    to: dateTime('2022-10-19T14:55:18.431Z'),
                    raw: {
                        from: 'now-6h',
                        to: 'now',
                    },
                },
                timeInfo: '',
                interval: '20s',
                intervalMs: 20000,
                targets: [logQuery],
                maxDataPoints: 909,
                scopedVars: scopedVars,
                startTime: 1666191318431,
                rangeRaw: {
                    from: 'now-6h',
                    to: 'now',
                },
            };
            ds.interpolateVariablesInFilters(logQuery, dataQR.scopedVars);
            expect(templateSrv.replace).toHaveBeenCalledWith('$someTagk', scopedVars, 'pipe');
            expect(templateSrv.replace).toHaveBeenCalledWith('$someTagv', scopedVars, 'pipe');
            expect(templateSrv.replace).toHaveBeenCalledTimes(2);
        });
    });
});
//# sourceMappingURL=datasource.test.js.map