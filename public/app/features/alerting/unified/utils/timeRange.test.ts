import { ReducerID } from '@grafana/data';
import { getTimeRangeForExpression } from './timeRange';
import { defaultCondition } from 'app/features/expressions/utils/expressionTypes';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { GrafanaAlertQuery } from 'app/types/unified-alerting-dto';

describe('timeRange', () => {
  describe('getTimeRangeForExpression', () => {
    describe('classic condition', () => {
      it('should return referenced query timeRange for classic condition', () => {
        const expressionQuery: GrafanaAlertQuery = {
          refId: 'B',
          queryType: 'expression',
          datasourceUid: '-100',
          model: {
            queryType: 'query',
            datasource: '__expr__',
            refId: 'B',
            conditions: [{ ...defaultCondition, query: { params: ['A'] } }],
            type: ExpressionQueryType.classic,
          } as ExpressionQuery,
        };
        const query: GrafanaAlertQuery = {
          refId: 'A',
          relativeTimeRange: { from: 300, to: 0 },
          queryType: 'query',
          datasourceUid: 'dsuid',
          model: { refId: 'A' },
        };
        const queries: GrafanaAlertQuery[] = [query, expressionQuery];

        expect(getTimeRangeForExpression(expressionQuery.model as ExpressionQuery, queries)).toEqual({
          from: 300,
          to: 0,
        });
      });

      it('should return the min and max time range', () => {
        const expressionQuery: GrafanaAlertQuery = {
          refId: 'C',
          queryType: 'expression',
          datasourceUid: '-100',
          model: {
            queryType: 'query',
            datasource: '__expr__',
            refId: 'C',
            conditions: [
              { ...defaultCondition, query: { params: ['A'] } },
              { ...defaultCondition, query: { params: ['B'] } },
            ],
            type: ExpressionQueryType.classic,
          } as ExpressionQuery,
        };
        const queryA: GrafanaAlertQuery = {
          refId: 'A',
          relativeTimeRange: { from: 300, to: 0 },
          datasourceUid: 'dsuid',
          model: { refId: 'A' },
          queryType: 'query',
        };
        const queryB: GrafanaAlertQuery = {
          refId: 'B',
          relativeTimeRange: { from: 600, to: 300 },
          datasourceUid: 'dsuid',
          model: { refId: 'B' },
          queryType: 'query',
        };
        const queries: GrafanaAlertQuery[] = [queryA, queryB, expressionQuery];

        expect(getTimeRangeForExpression(expressionQuery.model as ExpressionQuery, queries)).toEqual({
          from: 600,
          to: 0,
        });
      });
    });
  });
  describe('math', () => {
    it('should get timerange for referenced query', () => {
      const expressionQuery: GrafanaAlertQuery = {
        refId: 'B',
        queryType: 'expression',
        datasourceUid: '-100',
        model: {
          queryType: 'query',
          datasource: '__expr__',
          refId: 'B',
          expression: '$A > 10',
          type: ExpressionQueryType.math,
        } as ExpressionQuery,
      };

      const query: GrafanaAlertQuery = {
        refId: 'A',
        datasourceUid: 'dsuid',
        relativeTimeRange: { from: 300, to: 0 },
        model: { refId: 'A' },
        queryType: 'query',
      };

      expect(getTimeRangeForExpression(expressionQuery.model as ExpressionQuery, [expressionQuery, query]));
    });

    it('should get time ranges for multiple referenced queries', () => {
      const expressionQuery: GrafanaAlertQuery = {
        refId: 'C',
        queryType: 'expression',
        datasourceUid: '-100',
        model: {
          queryType: 'query',
          datasource: '__expr__',
          refId: 'C',
          expression: '$A > 10 && $queryB > 20',
          type: ExpressionQueryType.math,
        } as ExpressionQuery,
      };

      const queryA: GrafanaAlertQuery = {
        refId: 'A',
        relativeTimeRange: { from: 300, to: 0 },
        datasourceUid: 'dsuid',
        model: { refId: 'A' },
        queryType: 'query',
      };

      const queryB: GrafanaAlertQuery = {
        refId: 'queryB',
        relativeTimeRange: { from: 600, to: 300 },
        datasourceUid: 'dsuid',
        model: { refId: 'queryB' },
        queryType: 'query',
      };

      expect(
        getTimeRangeForExpression(expressionQuery.model as ExpressionQuery, [expressionQuery, queryA, queryB])
      ).toEqual({ from: 600, to: 0 });
    });
  });

  describe('resample', () => {
    it('should get referenced timerange for resample expression', () => {
      const expressionQuery: GrafanaAlertQuery = {
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
        } as ExpressionQuery,
      };

      const queryA: GrafanaAlertQuery = {
        refId: 'A',
        relativeTimeRange: { from: 300, to: 0 },
        datasourceUid: 'dsuid',
        model: { refId: 'A' },
        queryType: 'query',
      };

      const queries = [queryA, expressionQuery];

      expect(getTimeRangeForExpression(expressionQuery.model as ExpressionQuery, queries)).toEqual({
        from: 300,
        to: 0,
      });
    });
  });

  describe('reduce', () => {
    it('should get referenced timerange for reduce expression', () => {
      const expressionQuery: GrafanaAlertQuery = {
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
        } as ExpressionQuery,
      };

      const queryA: GrafanaAlertQuery = {
        refId: 'A',
        relativeTimeRange: { from: 300, to: 0 },
        datasourceUid: 'dsuid',
        model: { refId: 'A' },
        queryType: 'query',
      };

      const queries = [queryA, expressionQuery];

      expect(getTimeRangeForExpression(expressionQuery.model as ExpressionQuery, queries)).toEqual({
        from: 300,
        to: 0,
      });
    });
  });
});
