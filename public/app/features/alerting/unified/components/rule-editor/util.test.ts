import { ClassicCondition, ExpressionQuery } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';
import { queriesWithUpdatedReferences } from './util';

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
      expression: 'avg($A + $B) + $A',
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
    test('with classic expression', () => {
      const queries: AlertQuery[] = [dataSource, classicCondition];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'C');

      const queryModel = rewiredQueries[1].model as ExpressionQuery;

      const checkConditionParams = (condition: ClassicCondition) => {
        return expect(condition.query.params).toEqual(['C']);
      };

      expect(queryModel.conditions?.every(checkConditionParams));
    });

    test('with math expression', () => {
      const queries: AlertQuery[] = [dataSource, mathExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'C');

      const queryModel = rewiredQueries[1].model as ExpressionQuery;

      expect(queryModel.expression).toBe('avg($C + $B) + $C');
    });

    test('reduce expression', () => {
      const queries: AlertQuery[] = [dataSource, reduceExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'C');

      const queryModel = rewiredQueries[1].model as ExpressionQuery;
      expect(queryModel.expression).toBe('C');
    });

    test('resample expression', () => {
      const queries: AlertQuery[] = [dataSource, resampleExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'A', 'C');

      const queryModel = rewiredQueries[1].model as ExpressionQuery;
      expect(queryModel.expression).toBe('C');
    });
  });
});
