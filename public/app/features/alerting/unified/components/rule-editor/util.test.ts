import { ClassicCondition, ExpressionQuery } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';
import { queriesWithUpdatedReferences, updateMathExpressionRefs } from './util';

describe('rule-editor', () => {
  const dataSource: AlertQuery = {
    refId: 'A',
    datasourceUid: 'abc123',
    queryType: '',
    relativeTimeRange: {
      from: 600,
      to: 0,
    },
    model: {
      refId: 'A',
    },
  };

  const classicCondition = {
    refId: 'B',
    datasourceUid: '-100',
    queryType: '',
    model: {
      refId: 'B',
      type: 'classic_conditions',
      datasource: {
        uid: '-100',
        type: 'grafana-expression',
      },
      conditions: [
        {
          type: 'query',
          evaluator: {
            params: [3],
            type: 'gt',
          },
          operator: {
            type: 'and',
          },
          query: {
            params: ['A'],
          },
          reducer: {
            params: [],
            type: 'last',
          },
        },
      ],
    },
  };

  const mathExpression = {
    refId: 'B',
    datasourceUid: '-100',
    queryType: '',
    model: {
      refId: 'B',
      type: 'math',
      datasource: {
        uid: '-100',
        type: 'grafana-expression',
      },
      conditions: [],
      expression: 'abs($A) + $A',
    },
  };

  const reduceExpression = {
    refId: 'B',
    datasourceUid: '-100',
    queryType: '',
    model: {
      refId: 'B',
      type: 'reduce',
      datasource: {
        uid: '-100',
        type: 'grafana-expression',
      },
      conditions: [],
      reducer: 'mean',
      expression: 'A',
    },
  };

  const resampleExpression = {
    refId: 'A',
    datasourceUid: '-100',
    model: {
      refId: 'A',
      type: 'resample',
      datasource: {
        type: '__expr__',
        uid: '__expr__',
      },
      conditions: [],
      downsampler: 'mean',
      upsampler: 'fillna',
      expression: 'A',
      window: '30m',
    },
    queryType: '',
  };

  describe('rewires query names', () => {
    it('should rewire classic expressions', () => {
      const queries: AlertQuery[] = [dataSource, classicCondition];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'C');

      const queryModel = rewiredQueries[1].model as ExpressionQuery;

      const checkConditionParams = (condition: ClassicCondition) => {
        return expect(condition.query.params).toEqual(['C']);
      };

      expect(queryModel.conditions?.every(checkConditionParams));
    });

    it('should rewire math expressions', () => {
      const queries: AlertQuery[] = [dataSource, mathExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'Query A');

      const queryModel = rewiredQueries[1].model as ExpressionQuery;

      expect(queryModel.expression).toBe('abs(${Query A}) + ${Query A}');
    });

    it('should rewire reduce expressions', () => {
      const queries: AlertQuery[] = [dataSource, reduceExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'C');

      const queryModel = rewiredQueries[1].model as ExpressionQuery;
      expect(queryModel.expression).toBe('C');
    });

    it('should rewire resample expressions', () => {
      const queries: AlertQuery[] = [dataSource, resampleExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'C');

      const queryModel = rewiredQueries[1].model as ExpressionQuery;
      expect(queryModel.expression).toBe('C');
    });

    it('should rewire multiple expressions', () => {
      const queries: AlertQuery[] = [dataSource, mathExpression, resampleExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'C');

      expect(rewiredQueries[1].model as ExpressionQuery).toHaveProperty('expression', 'abs(${C}) + ${C}');
      expect(rewiredQueries[2].model as ExpressionQuery).toHaveProperty('expression', 'C');
    });

    it('should skip if refs are identical', () => {
      const queries: AlertQuery[] = [dataSource, reduceExpression, mathExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'A');

      expect(rewiredQueries[0]).toEqual(queries[0]);
      expect(rewiredQueries[1]).toEqual(queries[1]);
      expect(rewiredQueries[2]).toEqual(queries[2]);
    });
  });

  describe('updateMathExpressionRefs', () => {
    it('should rewire refs without brackets', () => {
      expect(updateMathExpressionRefs('abs($Foo) + $Foo', 'Foo', 'Bar')).toBe('abs(${Bar}) + ${Bar}');
    });
    it('should rewire refs with brackets', () => {
      expect(updateMathExpressionRefs('abs(${Foo}) + $Foo', 'Foo', 'Bar')).toBe('abs(${Bar}) + ${Bar}');
    });
  });
});
