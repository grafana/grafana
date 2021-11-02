import { __assign } from "tslib";
import { buildQueryTransaction, clearHistory, DEFAULT_RANGE, getRefIds, getValueWithRefId, hasNonEmptyQuery, parseUrlState, refreshIntervalToSortOrder, updateHistory, getExploreUrl, getTimeRangeFromUrl, } from './explore';
import store from 'app/core/store';
import { dateTime, LogsSortOrder } from '@grafana/data';
import { RefreshPicker } from '@grafana/ui';
import { serializeStateToUrlParam } from '@grafana/data/src/utils/url';
import { ExploreId } from '../../types';
var DEFAULT_EXPLORE_STATE = {
    datasource: '',
    queries: [],
    range: DEFAULT_RANGE,
    originPanelId: undefined,
};
describe('state functions', function () {
    describe('parseUrlState', function () {
        it('returns default state on empty string', function () {
            expect(parseUrlState('')).toMatchObject({
                datasource: null,
                queries: [],
                range: DEFAULT_RANGE,
            });
        });
        it('returns a valid Explore state from URL parameter', function () {
            var paramValue = '{"datasource":"Local","queries":[{"expr":"metric"}],"range":{"from":"now-1h","to":"now"}}';
            expect(parseUrlState(paramValue)).toMatchObject({
                datasource: 'Local',
                queries: [{ expr: 'metric' }],
                range: {
                    from: 'now-1h',
                    to: 'now',
                },
            });
        });
        it('returns a valid Explore state from a compact URL parameter', function () {
            var paramValue = '["now-1h","now","Local",{"expr":"metric"},{"ui":[true,true,true,"none"]}]';
            expect(parseUrlState(paramValue)).toMatchObject({
                datasource: 'Local',
                queries: [{ expr: 'metric' }],
                range: {
                    from: 'now-1h',
                    to: 'now',
                },
            });
        });
        it('should not return a query for mode in the url', function () {
            // Previous versions of Grafana included "Explore mode" in the URL; this should not be treated as a query.
            var paramValue = '["now-1h","now","x-ray-datasource",{"queryType":"getTraceSummaries"},{"mode":"Metrics"},{"ui":[true,true,true,"none"]}]';
            expect(parseUrlState(paramValue)).toMatchObject({
                datasource: 'x-ray-datasource',
                queries: [{ queryType: 'getTraceSummaries' }],
                range: {
                    from: 'now-1h',
                    to: 'now',
                },
            });
        });
        it('should return queries if queryType is present in the url', function () {
            var paramValue = '["now-1h","now","x-ray-datasource",{"queryType":"getTraceSummaries"},{"ui":[true,true,true,"none"]}]';
            expect(parseUrlState(paramValue)).toMatchObject({
                datasource: 'x-ray-datasource',
                queries: [{ queryType: 'getTraceSummaries' }],
                range: {
                    from: 'now-1h',
                    to: 'now',
                },
            });
        });
    });
    describe('serializeStateToUrlParam', function () {
        it('returns url parameter value for a state object', function () {
            var state = __assign(__assign({}, DEFAULT_EXPLORE_STATE), { datasource: 'foo', queries: [
                    {
                        expr: 'metric{test="a/b"}',
                        refId: 'A',
                    },
                    {
                        expr: 'super{foo="x/z"}',
                        refId: 'B',
                    },
                ], range: {
                    from: 'now-5h',
                    to: 'now',
                } });
            expect(serializeStateToUrlParam(state)).toBe('{"datasource":"foo","queries":[{"expr":"metric{test=\\"a/b\\"}","refId":"A"},' +
                '{"expr":"super{foo=\\"x/z\\"}","refId":"B"}],"range":{"from":"now-5h","to":"now"}}');
        });
        it('returns url parameter value for a state object', function () {
            var state = __assign(__assign({}, DEFAULT_EXPLORE_STATE), { datasource: 'foo', queries: [
                    {
                        expr: 'metric{test="a/b"}',
                        refId: 'A',
                    },
                    {
                        expr: 'super{foo="x/z"}',
                        refId: 'B',
                    },
                ], range: {
                    from: 'now-5h',
                    to: 'now',
                } });
            expect(serializeStateToUrlParam(state, true)).toBe('["now-5h","now","foo",{"expr":"metric{test=\\"a/b\\"}","refId":"A"},{"expr":"super{foo=\\"x/z\\"}","refId":"B"}]');
        });
    });
    describe('interplay', function () {
        it('can parse the serialized state into the original state', function () {
            var state = __assign(__assign({}, DEFAULT_EXPLORE_STATE), { datasource: 'foo', queries: [
                    {
                        expr: 'metric{test="a/b"}',
                        refId: 'A',
                    },
                    {
                        expr: 'super{foo="x/z"}',
                        refId: 'B',
                    },
                ], range: {
                    from: 'now - 5h',
                    to: 'now',
                } });
            var serialized = serializeStateToUrlParam(state);
            var parsed = parseUrlState(serialized);
            expect(state).toMatchObject(parsed);
        });
        it('can parse the compact serialized state into the original state', function () {
            var state = __assign(__assign({}, DEFAULT_EXPLORE_STATE), { datasource: 'foo', queries: [
                    {
                        expr: 'metric{test="a/b"}',
                        refId: 'A',
                    },
                    {
                        expr: 'super{foo="x/z"}',
                        refId: 'B',
                    },
                ], range: {
                    from: 'now - 5h',
                    to: 'now',
                } });
            var serialized = serializeStateToUrlParam(state, true);
            var parsed = parseUrlState(serialized);
            expect(state).toMatchObject(parsed);
        });
    });
});
describe('getExploreUrl', function () {
    var args = {
        panel: {
            getSavedId: function () { return 1; },
            targets: [{ refId: 'A', expr: 'query1', legendFormat: 'legendFormat1' }],
        },
        datasourceSrv: {
            get: function () {
                return {
                    getRef: jest.fn(),
                };
            },
            getDataSourceById: jest.fn(),
        },
        timeSrv: {
            timeRangeForUrl: function () { return '1'; },
        },
    };
    it('should omit legendFormat in explore url', function () {
        expect(getExploreUrl(args).then(function (data) { return expect(data).not.toMatch(/legendFormat1/g); }));
    });
});
describe('updateHistory()', function () {
    var datasourceId = 'myDatasource';
    var key = "grafana.explore.history." + datasourceId;
    beforeEach(function () {
        clearHistory(datasourceId);
        expect(store.exists(key)).toBeFalsy();
    });
    test('should save history item to localStorage', function () {
        var expected = [
            {
                query: { refId: '1', expr: 'metric' },
            },
        ];
        expect(updateHistory([], datasourceId, [{ refId: '1', expr: 'metric' }])).toMatchObject(expected);
        expect(store.exists(key)).toBeTruthy();
        expect(store.getObject(key)).toMatchObject(expected);
    });
});
describe('hasNonEmptyQuery', function () {
    test('should return true if one query is non-empty', function () {
        expect(hasNonEmptyQuery([{ refId: '1', key: '2', context: 'explore', expr: 'foo' }])).toBeTruthy();
    });
    test('should return false if query is empty', function () {
        expect(hasNonEmptyQuery([{ refId: '1', key: '2', context: 'panel', datasource: { uid: 'some-ds' } }])).toBeFalsy();
    });
    test('should return false if no queries exist', function () {
        expect(hasNonEmptyQuery([])).toBeFalsy();
    });
});
describe('hasRefId', function () {
    describe('when called with a null value', function () {
        it('then it should return undefined', function () {
            var input = null;
            var result = getValueWithRefId(input);
            expect(result).toBeUndefined();
        });
    });
    describe('when called with a non object value', function () {
        it('then it should return undefined', function () {
            var input = 123;
            var result = getValueWithRefId(input);
            expect(result).toBeUndefined();
        });
    });
    describe('when called with an object that has refId', function () {
        it('then it should return the object', function () {
            var input = { refId: 'A' };
            var result = getValueWithRefId(input);
            expect(result).toBe(input);
        });
    });
    describe('when called with an array that has refId', function () {
        it('then it should return the object', function () {
            var input = [123, null, {}, { refId: 'A' }];
            var result = getValueWithRefId(input);
            expect(result).toBe(input[3]);
        });
    });
    describe('when called with an object that has refId somewhere in the object tree', function () {
        it('then it should return the object', function () {
            var input = { data: [123, null, {}, { series: [123, null, {}, { refId: 'A' }] }] };
            var result = getValueWithRefId(input);
            expect(result).toBe(input.data[3].series[3]);
        });
    });
});
describe('getTimeRangeFromUrl', function () {
    it('should parse moment date', function () {
        // convert date strings to moment object
        var range = { from: dateTime('2020-10-22T10:44:33.615Z'), to: dateTime('2020-10-22T10:49:33.615Z') };
        var result = getTimeRangeFromUrl(range, 'browser', 0);
        expect(result.raw).toEqual(range);
    });
    it('should parse epoch strings', function () {
        var range = {
            from: dateTime('2020-10-22T10:00:00Z').valueOf().toString(),
            to: dateTime('2020-10-22T11:00:00Z').valueOf().toString(),
        };
        var result = getTimeRangeFromUrl(range, 'browser', 0);
        expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
        expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
        expect(result.raw.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
        expect(result.raw.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
    });
    it('should parse ISO strings', function () {
        var range = {
            from: dateTime('2020-10-22T10:00:00Z').toISOString(),
            to: dateTime('2020-10-22T11:00:00Z').toISOString(),
        };
        var result = getTimeRangeFromUrl(range, 'browser', 0);
        expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
        expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
        expect(result.raw.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
        expect(result.raw.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
    });
});
describe('getRefIds', function () {
    describe('when called with a null value', function () {
        it('then it should return empty array', function () {
            var input = null;
            var result = getRefIds(input);
            expect(result).toEqual([]);
        });
    });
    describe('when called with a non object value', function () {
        it('then it should return empty array', function () {
            var input = 123;
            var result = getRefIds(input);
            expect(result).toEqual([]);
        });
    });
    describe('when called with an object that has refId', function () {
        it('then it should return an array with that refId', function () {
            var input = { refId: 'A' };
            var result = getRefIds(input);
            expect(result).toEqual(['A']);
        });
    });
    describe('when called with an array that has refIds', function () {
        it('then it should return an array with unique refIds', function () {
            var input = [123, null, {}, { refId: 'A' }, { refId: 'A' }, { refId: 'B' }];
            var result = getRefIds(input);
            expect(result).toEqual(['A', 'B']);
        });
    });
    describe('when called with an object that has refIds somewhere in the object tree', function () {
        it('then it should return return an array with unique refIds', function () {
            var input = {
                data: [
                    123,
                    null,
                    { refId: 'B', series: [{ refId: 'X' }] },
                    { refId: 'B' },
                    {},
                    { series: [123, null, {}, { refId: 'A' }] },
                ],
            };
            var result = getRefIds(input);
            expect(result).toEqual(['B', 'X', 'A']);
        });
    });
});
describe('refreshIntervalToSortOrder', function () {
    describe('when called with live option', function () {
        it('then it should return ascending', function () {
            var result = refreshIntervalToSortOrder(RefreshPicker.liveOption.value);
            expect(result).toBe(LogsSortOrder.Ascending);
        });
    });
    describe('when called with off option', function () {
        it('then it should return descending', function () {
            var result = refreshIntervalToSortOrder(RefreshPicker.offOption.value);
            expect(result).toBe(LogsSortOrder.Descending);
        });
    });
    describe('when called with 5s option', function () {
        it('then it should return descending', function () {
            var result = refreshIntervalToSortOrder('5s');
            expect(result).toBe(LogsSortOrder.Descending);
        });
    });
    describe('when called with undefined', function () {
        it('then it should return descending', function () {
            var result = refreshIntervalToSortOrder(undefined);
            expect(result).toBe(LogsSortOrder.Descending);
        });
    });
});
describe('when buildQueryTransaction', function () {
    it('it should calculate interval based on time range', function () {
        var queries = [{ refId: 'A' }];
        var queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
        var range = { from: dateTime().subtract(1, 'd'), to: dateTime(), raw: { from: '1h', to: '1h' } };
        var transaction = buildQueryTransaction(ExploreId.left, queries, queryOptions, range, false);
        expect(transaction.request.intervalMs).toEqual(60000);
    });
    it('it should calculate interval taking minInterval into account', function () {
        var queries = [{ refId: 'A' }];
        var queryOptions = { maxDataPoints: 1000, minInterval: '15s' };
        var range = { from: dateTime().subtract(1, 'm'), to: dateTime(), raw: { from: '1h', to: '1h' } };
        var transaction = buildQueryTransaction(ExploreId.left, queries, queryOptions, range, false);
        expect(transaction.request.intervalMs).toEqual(15000);
    });
    it('it should calculate interval taking maxDataPoints into account', function () {
        var queries = [{ refId: 'A' }];
        var queryOptions = { maxDataPoints: 10, minInterval: '15s' };
        var range = { from: dateTime().subtract(1, 'd'), to: dateTime(), raw: { from: '1h', to: '1h' } };
        var transaction = buildQueryTransaction(ExploreId.left, queries, queryOptions, range, false);
        expect(transaction.request.interval).toEqual('2h');
    });
});
//# sourceMappingURL=explore.test.js.map