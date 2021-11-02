import { __assign } from "tslib";
import { ReducerID } from '@grafana/data';
import { getTimeRangeForExpression } from './timeRange';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { ExpressionQueryType } from 'app/features/expressions/types';
describe('timeRange', function () {
    describe('getTimeRangeForExpression', function () {
        describe('classic condition', function () {
            it('should return referenced query timeRange for classic condition', function () {
                var expressionQuery = {
                    refId: 'B',
                    queryType: 'expression',
                    datasourceUid: '-100',
                    model: {
                        queryType: 'query',
                        datasource: '__expr__',
                        refId: 'B',
                        conditions: [__assign(__assign({}, defaultCondition), { query: { params: ['A'] } })],
                        type: ExpressionQueryType.classic,
                    },
                };
                var query = {
                    refId: 'A',
                    relativeTimeRange: { from: 300, to: 0 },
                    queryType: 'query',
                    datasourceUid: 'dsuid',
                    model: { refId: 'A' },
                };
                var queries = [query, expressionQuery];
                expect(getTimeRangeForExpression(expressionQuery.model, queries)).toEqual({
                    from: 300,
                    to: 0,
                });
            });
            it('should return the min and max time range', function () {
                var expressionQuery = {
                    refId: 'C',
                    queryType: 'expression',
                    datasourceUid: '-100',
                    model: {
                        queryType: 'query',
                        datasource: '__expr__',
                        refId: 'C',
                        conditions: [
                            __assign(__assign({}, defaultCondition), { query: { params: ['A'] } }),
                            __assign(__assign({}, defaultCondition), { query: { params: ['B'] } }),
                        ],
                        type: ExpressionQueryType.classic,
                    },
                };
                var queryA = {
                    refId: 'A',
                    relativeTimeRange: { from: 300, to: 0 },
                    datasourceUid: 'dsuid',
                    model: { refId: 'A' },
                    queryType: 'query',
                };
                var queryB = {
                    refId: 'B',
                    relativeTimeRange: { from: 600, to: 300 },
                    datasourceUid: 'dsuid',
                    model: { refId: 'B' },
                    queryType: 'query',
                };
                var queries = [queryA, queryB, expressionQuery];
                expect(getTimeRangeForExpression(expressionQuery.model, queries)).toEqual({
                    from: 600,
                    to: 0,
                });
            });
        });
    });
    describe('math', function () {
        it('should get timerange for referenced query', function () {
            var expressionQuery = {
                refId: 'B',
                queryType: 'expression',
                datasourceUid: '-100',
                model: {
                    queryType: 'query',
                    datasource: '__expr__',
                    refId: 'B',
                    expression: '$A > 10',
                    type: ExpressionQueryType.math,
                },
            };
            var query = {
                refId: 'A',
                datasourceUid: 'dsuid',
                relativeTimeRange: { from: 300, to: 0 },
                model: { refId: 'A' },
                queryType: 'query',
            };
            expect(getTimeRangeForExpression(expressionQuery.model, [expressionQuery, query]));
        });
        it('should get time ranges for multiple referenced queries', function () {
            var expressionQuery = {
                refId: 'C',
                queryType: 'expression',
                datasourceUid: '-100',
                model: {
                    queryType: 'query',
                    datasource: '__expr__',
                    refId: 'C',
                    expression: '$A > 10 && $queryB > 20',
                    type: ExpressionQueryType.math,
                },
            };
            var queryA = {
                refId: 'A',
                relativeTimeRange: { from: 300, to: 0 },
                datasourceUid: 'dsuid',
                model: { refId: 'A' },
                queryType: 'query',
            };
            var queryB = {
                refId: 'queryB',
                relativeTimeRange: { from: 600, to: 300 },
                datasourceUid: 'dsuid',
                model: { refId: 'queryB' },
                queryType: 'query',
            };
            expect(getTimeRangeForExpression(expressionQuery.model, [expressionQuery, queryA, queryB])).toEqual({ from: 600, to: 0 });
        });
    });
    describe('resample', function () {
        it('should get referenced timerange for resample expression', function () {
            var expressionQuery = {
                refId: 'B',
                queryType: 'expression',
                datasourceUid: '-100',
                model: {
                    queryType: 'query',
                    datasource: '__expr__',
                    refId: 'B',
                    expression: 'A',
                    type: ExpressionQueryType.resample,
                    window: '10s',
                },
            };
            var queryA = {
                refId: 'A',
                relativeTimeRange: { from: 300, to: 0 },
                datasourceUid: 'dsuid',
                model: { refId: 'A' },
                queryType: 'query',
            };
            var queries = [queryA, expressionQuery];
            expect(getTimeRangeForExpression(expressionQuery.model, queries)).toEqual({
                from: 300,
                to: 0,
            });
        });
    });
    describe('reduce', function () {
        it('should get referenced timerange for reduce expression', function () {
            var expressionQuery = {
                refId: 'B',
                queryType: 'expression',
                datasourceUid: '-100',
                model: {
                    queryType: 'query',
                    datasource: '__expr__',
                    refId: 'B',
                    expression: 'A',
                    type: ExpressionQueryType.reduce,
                    reducer: ReducerID.max,
                },
            };
            var queryA = {
                refId: 'A',
                relativeTimeRange: { from: 300, to: 0 },
                datasourceUid: 'dsuid',
                model: { refId: 'A' },
                queryType: 'query',
            };
            var queries = [queryA, expressionQuery];
            expect(getTimeRangeForExpression(expressionQuery.model, queries)).toEqual({
                from: 300,
                to: 0,
            });
        });
    });
});
//# sourceMappingURL=timeRange.test.js.map