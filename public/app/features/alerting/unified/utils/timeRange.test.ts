import { ReducerID } from '@grafana/data';
import { getTimeRangeForExpression } from './timeRange';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { GrafanaExpressionModel, GrafanaQuery, GrafanaQueryModel } from 'app/types/unified-alerting-dto';

describe('timeRange', () => {
  describe('getTimeRangeForExpression', () => {
    describe('classic condition', () => {
      it('should return referenced query timeRange for classic condition', () => {
        const expressionQuery: GrafanaQuery = {
          refId: 'B',
          queryType: 'expression',
          model: {
            queryType: 'query',
            datasource: '__expr__',
            datasourceUid: '-100',
            refId: 'B',
            conditions: [{ ...defaultCondition, query: { params: ['A'] } }],
            type: ExpressionQueryType.classic,
          },
        };
        const query: GrafanaQuery = {
          refId: 'A',
          relativeTimeRange: { from: 300, to: 0 },
          model: {} as GrafanaQueryModel,
          queryType: 'query',
        };
        const queries: GrafanaQuery[] = [query, expressionQuery];

        expect(getTimeRangeForExpression(expressionQuery.model as GrafanaExpressionModel, queries)).toEqual({
          from: 300,
          to: 0,
        });
      });

      it('should return the min and max time range', () => {
        const expressionQuery: GrafanaQuery = {
          refId: 'C',
          queryType: 'expression',
          model: {
            queryType: 'query',
            datasource: '__expr__',
            datasourceUid: '-100',
            refId: 'C',
            conditions: [
              { ...defaultCondition, query: { params: ['A'] } },
              { ...defaultCondition, query: { params: ['B'] } },
            ],
            type: ExpressionQueryType.classic,
          },
        };
        const queryA: GrafanaQuery = {
          refId: 'A',
          relativeTimeRange: { from: 300, to: 0 },
          model: {} as GrafanaQueryModel,
          queryType: 'query',
        };
        const queryB: GrafanaQuery = {
          refId: 'B',
          relativeTimeRange: { from: 600, to: 300 },
          model: {} as GrafanaQueryModel,
          queryType: 'query',
        };
        const queries: GrafanaQuery[] = [queryA, queryB, expressionQuery];

        expect(getTimeRangeForExpression(expressionQuery.model as GrafanaExpressionModel, queries)).toEqual({
          from: 600,
          to: 0,
        });
      });
    });
  });
  describe('math', () => {
    it('should get timerange for referenced query', () => {
      const expressionQuery: GrafanaQuery = {
        refId: 'B',
        queryType: 'expression',
        model: {
          queryType: 'query',
          datasource: '__expr__',
          datasourceUid: '-100',
          refId: 'B',
          expression: '$A > 10',
          type: ExpressionQueryType.math,
        },
      };

      const query: GrafanaQuery = {
        refId: 'A',
        relativeTimeRange: { from: 300, to: 0 },
        model: {} as GrafanaQueryModel,
        queryType: 'query',
      };

      expect(getTimeRangeForExpression(expressionQuery.model as GrafanaExpressionModel, [expressionQuery, query]));
    });

    it('should get time ranges for multiple referenced queries', () => {
      const expressionQuery: GrafanaQuery = {
        refId: 'C',
        queryType: 'expression',
        model: {
          queryType: 'query',
          datasource: '__expr__',
          datasourceUid: '-100',
          refId: 'C',
          expression: '$A > 10 && $queryB > 20',
          type: ExpressionQueryType.math,
        },
      };

      const queryA: GrafanaQuery = {
        refId: 'A',
        relativeTimeRange: { from: 300, to: 0 },
        model: {} as GrafanaQueryModel,
        queryType: 'query',
      };

      const queryB: GrafanaQuery = {
        refId: 'queryB',
        relativeTimeRange: { from: 600, to: 300 },
        model: {} as GrafanaQueryModel,
        queryType: 'query',
      };

      expect(
        getTimeRangeForExpression(expressionQuery.model as GrafanaExpressionModel, [expressionQuery, queryA, queryB])
      ).toEqual({ from: 600, to: 0 });
    });
  });

  describe('resample', () => {
    it('should get referenced timerange for resample expression', () => {
      const expressionQuery: GrafanaQuery = {
        refId: 'B',
        queryType: 'expression',
        model: {
          queryType: 'query',
          datasource: '__expr__',
          datasourceUid: '-100',
          refId: 'B',
          expression: 'A',
          type: ExpressionQueryType.resample,
          window: '10s',
        },
      };

      const queryA: GrafanaQuery = {
        refId: 'A',
        relativeTimeRange: { from: 300, to: 0 },
        model: {} as GrafanaQueryModel,
        queryType: 'query',
      };

      const queries = [queryA, expressionQuery];

      expect(getTimeRangeForExpression(expressionQuery.model as GrafanaExpressionModel, queries)).toEqual({
        from: 300,
        to: 0,
      });
    });
  });

  describe('reduce', () => {
    it('should get referenced timerange for reduce expression', () => {
      const expressionQuery: GrafanaQuery = {
        refId: 'B',
        queryType: 'expression',
        model: {
          queryType: 'query',
          datasource: '__expr__',
          datasourceUid: '-100',
          refId: 'B',
          expression: 'A',
          type: ExpressionQueryType.reduce,
          reducer: ReducerID.max,
        },
      };

      const queryA: GrafanaQuery = {
        refId: 'A',
        relativeTimeRange: { from: 300, to: 0 },
        model: {} as GrafanaQueryModel,
        queryType: 'query',
      };

      const queries = [queryA, expressionQuery];

      expect(getTimeRangeForExpression(expressionQuery.model as GrafanaExpressionModel, queries)).toEqual({
        from: 300,
        to: 0,
      });
    });
  });
});
