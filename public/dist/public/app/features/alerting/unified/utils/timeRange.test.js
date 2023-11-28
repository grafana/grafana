import { ReducerID } from '@grafana/data';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { getTimeRangeForExpression } from './timeRange';
describe('timeRange', () => {
    describe('getTimeRangeForExpression', () => {
        describe('classic condition', () => {
            it('should return referenced query timeRange for classic condition', () => {
                const expressionQuery = {
                    refId: 'B',
                    queryType: 'expression',
                    datasourceUid: '__expr__',
                    model: {
                        queryType: 'query',
                        datasource: '__expr__',
                        refId: 'B',
                        conditions: [Object.assign(Object.assign({}, defaultCondition), { query: { params: ['A'] } })],
                        type: ExpressionQueryType.classic,
                    },
                };
                const query = {
                    refId: 'A',
                    relativeTimeRange: { from: 300, to: 0 },
                    queryType: 'query',
                    datasourceUid: 'dsuid',
                    model: { refId: 'A' },
                };
                const queries = [query, expressionQuery];
                expect(getTimeRangeForExpression(expressionQuery.model, queries)).toEqual({
                    from: 300,
                    to: 0,
                });
            });
            it('should return the min and max time range', () => {
                const expressionQuery = {
                    refId: 'C',
                    queryType: 'expression',
                    datasourceUid: '__expr__',
                    model: {
                        queryType: 'query',
                        datasource: '__expr__',
                        refId: 'C',
                        conditions: [
                            Object.assign(Object.assign({}, defaultCondition), { query: { params: ['A'] } }),
                            Object.assign(Object.assign({}, defaultCondition), { query: { params: ['B'] } }),
                        ],
                        type: ExpressionQueryType.classic,
                    },
                };
                const queryA = {
                    refId: 'A',
                    relativeTimeRange: { from: 300, to: 0 },
                    datasourceUid: 'dsuid',
                    model: { refId: 'A' },
                    queryType: 'query',
                };
                const queryB = {
                    refId: 'B',
                    relativeTimeRange: { from: 600, to: 300 },
                    datasourceUid: 'dsuid',
                    model: { refId: 'B' },
                    queryType: 'query',
                };
                const queries = [queryA, queryB, expressionQuery];
                expect(getTimeRangeForExpression(expressionQuery.model, queries)).toEqual({
                    from: 600,
                    to: 0,
                });
            });
        });
    });
    describe('math', () => {
        it('should get timerange for referenced query', () => {
            const expressionQuery = {
                refId: 'B',
                queryType: 'expression',
                datasourceUid: '__expr__',
                model: {
                    queryType: 'query',
                    datasource: '__expr__',
                    refId: 'B',
                    expression: '$A > 10',
                    type: ExpressionQueryType.math,
                },
            };
            const query = {
                refId: 'A',
                datasourceUid: 'dsuid',
                relativeTimeRange: { from: 300, to: 0 },
                model: { refId: 'A' },
                queryType: 'query',
            };
            expect(getTimeRangeForExpression(expressionQuery.model, [expressionQuery, query]));
        });
        it('should get time ranges for multiple referenced queries', () => {
            const expressionQuery = {
                refId: 'C',
                queryType: 'expression',
                datasourceUid: '__expr__',
                model: {
                    queryType: 'query',
                    datasource: '__expr__',
                    refId: 'C',
                    expression: '$A > 10 && $queryB > 20',
                    type: ExpressionQueryType.math,
                },
            };
            const queryA = {
                refId: 'A',
                relativeTimeRange: { from: 300, to: 0 },
                datasourceUid: 'dsuid',
                model: { refId: 'A' },
                queryType: 'query',
            };
            const queryB = {
                refId: 'queryB',
                relativeTimeRange: { from: 600, to: 300 },
                datasourceUid: 'dsuid',
                model: { refId: 'queryB' },
                queryType: 'query',
            };
            expect(getTimeRangeForExpression(expressionQuery.model, [expressionQuery, queryA, queryB])).toEqual({ from: 600, to: 0 });
        });
    });
    describe('resample', () => {
        it('should get referenced timerange for resample expression', () => {
            const expressionQuery = {
                refId: 'B',
                queryType: 'expression',
                datasourceUid: '__expr__',
                model: {
                    queryType: 'query',
                    datasource: '__expr__',
                    refId: 'B',
                    expression: 'A',
                    type: ExpressionQueryType.resample,
                    window: '10s',
                },
            };
            const queryA = {
                refId: 'A',
                relativeTimeRange: { from: 300, to: 0 },
                datasourceUid: 'dsuid',
                model: { refId: 'A' },
                queryType: 'query',
            };
            const queries = [queryA, expressionQuery];
            expect(getTimeRangeForExpression(expressionQuery.model, queries)).toEqual({
                from: 300,
                to: 0,
            });
        });
    });
    describe('reduce', () => {
        it('should get referenced timerange for reduce expression', () => {
            const expressionQuery = {
                refId: 'B',
                queryType: 'expression',
                datasourceUid: '__expr__',
                model: {
                    queryType: 'query',
                    datasource: '__expr__',
                    refId: 'B',
                    expression: 'A',
                    type: ExpressionQueryType.reduce,
                    reducer: ReducerID.max,
                },
            };
            const queryA = {
                refId: 'A',
                relativeTimeRange: { from: 300, to: 0 },
                datasourceUid: 'dsuid',
                model: { refId: 'A' },
                queryType: 'query',
            };
            const queries = [queryA, expressionQuery];
            expect(getTimeRangeForExpression(expressionQuery.model, queries)).toEqual({
                from: 300,
                to: 0,
            });
        });
    });
});
//# sourceMappingURL=timeRange.test.js.map