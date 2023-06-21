import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { ClassicCondition, ExpressionQuery } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import {
  checkForPathSeparator,
  getThresholdsForQueries,
  queriesWithUpdatedReferences,
  updateMathExpressionRefs,
} from './util';

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
    datasourceUid: '__expr__',
    queryType: '',
    model: {
      refId: 'B',
      type: 'classic_conditions',
      datasource: ExpressionDatasourceRef,
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
    datasourceUid: '__expr__',
    queryType: '',
    model: {
      refId: 'B',
      type: 'math',
      datasource: ExpressionDatasourceRef,
      conditions: [],
      expression: 'abs($A) + $A',
    },
  };

  const reduceExpression = {
    refId: 'B',
    datasourceUid: '__expr__',
    queryType: '',
    model: {
      refId: 'B',
      type: 'reduce',
      datasource: ExpressionDatasourceRef,
      conditions: [],
      reducer: 'mean',
      expression: 'A',
    },
  };

  const resampleExpression = {
    refId: 'A',
    datasourceUid: '__expr__',
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

  const thresholdExpression = {
    refId: 'C',
    datasourceUid: '__expr__',
    model: {
      refId: 'C',
      type: 'threshold',
      expression: 'B',
      datasource: {
        type: '__expr__',
        uid: '__expr__',
      },
      conditions: [
        {
          evaluator: {
            params: [0, 'gt'],
          },
        },
      ],
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

    it('should rewire threshold expressions', () => {
      const queries: AlertQuery[] = [dataSource, reduceExpression, thresholdExpression];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'B', 'REDUCER');

      const queryModel = rewiredQueries[2].model as ExpressionQuery;
      expect(queryModel.expression).toBe('REDUCER');
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

    it('should not rewire non-referencing expressions', () => {
      const dataSource1 = { ...dataSource, refId: 'Q1' };
      const dataSource2 = { ...dataSource, refId: 'Q2' };
      const condition1 = {
        ...classicCondition,
        refId: 'A',
        model: {
          ...classicCondition.model,
          conditions: [
            {
              ...classicCondition.model.conditions[0],
              query: { params: ['Q1'] },
            },
          ],
        },
      };
      const condition2 = { ...reduceExpression, refId: 'B', model: { ...reduceExpression.model, expression: 'Q1' } };
      const condition3 = { ...mathExpression, refId: 'C', model: { ...mathExpression.model, expression: '${Q1}' } };

      const queries: AlertQuery[] = [dataSource1, dataSource2, condition1, condition2, condition3];
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'Q2', 'Q3');

      expect(rewiredQueries[0]).toEqual(queries[0]);
      expect(rewiredQueries[1]).toEqual(queries[1]);
      expect(rewiredQueries[2]).toEqual(queries[2]);
      expect(rewiredQueries[3]).toEqual(queries[3]);
      expect(rewiredQueries[4]).toEqual(queries[4]);
    });
  });

  describe('updateMathExpressionRefs', () => {
    it('should rewire refs without brackets', () => {
      expect(updateMathExpressionRefs('abs($Foo) + $Foo', 'Foo', 'Bar')).toBe('abs(${Bar}) + ${Bar}');
    });
    it('should rewire refs with brackets', () => {
      expect(updateMathExpressionRefs('abs(${Foo}) + $Foo', 'Foo', 'Bar')).toBe('abs(${Bar}) + ${Bar}');
    });
    it('should not rewire refs with partial variable match', () => {
      expect(updateMathExpressionRefs('$A3 + $B', 'A', 'C')).toBe('$A3 + $B');
    });
  });
});

describe('checkForPathSeparator', () => {
  it('should not allow strings with /', () => {
    expect(checkForPathSeparator('foo / bar')).not.toBe(true);
    expect(typeof checkForPathSeparator('foo / bar')).toBe('string');
  });
  it('should not allow strings with \\', () => {
    expect(checkForPathSeparator('foo \\ bar')).not.toBe(true);
    expect(typeof checkForPathSeparator('foo \\ bar')).toBe('string');
  });
  it('should allow anything without / or \\', () => {
    expect(checkForPathSeparator('foo bar')).toBe(true);
  });
});

describe('getThresholdsForQueries', () => {
  it('should work for threshold condition', () => {
    const queries = createThresholdExample('gt');
    expect(getThresholdsForQueries(queries)).toMatchSnapshot();
  });

  it('should work for classic_condition', () => {
    const [dataQuery] = createThresholdExample('gt');

    const classicCondition = {
      refId: 'B',
      datasourceUid: '__expr__',
      queryType: '',
      model: {
        refId: 'B',
        type: 'classic_conditions',
        datasource: ExpressionDatasourceRef,
        conditions: [
          {
            type: 'query',
            evaluator: {
              params: [0],
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

    const thresholdsClassic = getThresholdsForQueries([dataQuery, classicCondition]);
    expect(thresholdsClassic).toMatchSnapshot();
  });

  it('should not throw if no refId exists', () => {
    const dataQuery: AlertQuery = {
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
      datasourceUid: '__expr__',
      queryType: '',
      model: {
        refId: 'B',
        type: 'classic_conditions',
        datasource: ExpressionDatasourceRef,
        conditions: [
          {
            type: 'query',
            evaluator: {
              params: [0],
              type: 'gt',
            },
            operator: {
              type: 'and',
            },
            query: {
              params: [''],
            },
            reducer: {
              params: [],
              type: 'last',
            },
          },
        ],
      },
    };

    expect(() => {
      const thresholds = getThresholdsForQueries([dataQuery, classicCondition]);
      expect(thresholds).toStrictEqual({});
    }).not.toThrowError();
  });

  it('should work for within_range', () => {
    const queries = createThresholdExample('within_range');
    const thresholds = getThresholdsForQueries(queries);
    expect(thresholds).toMatchSnapshot();
  });

  it('should work for lt and gt', () => {
    expect(getThresholdsForQueries(createThresholdExample('gt'))).toMatchSnapshot();
    expect(getThresholdsForQueries(createThresholdExample('lt'))).toMatchSnapshot();
  });

  it('should work for outside_range', () => {
    const queries = createThresholdExample('outside_range');
    const thresholds = getThresholdsForQueries(queries);
    expect(thresholds).toMatchSnapshot();
  });
});

function createThresholdExample(thresholdType: string): AlertQuery[] {
  const dataQuery: AlertQuery = {
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

  const reduceExpression = {
    refId: 'B',
    datasourceUid: '__expr__',
    queryType: '',
    model: {
      refId: 'B',
      type: 'reduce',
      datasource: ExpressionDatasourceRef,
      conditions: [],
      reducer: 'mean',
      expression: 'A',
    },
  };

  const thresholdExpression = {
    refId: 'C',
    datasourceUid: '__expr__',
    queryType: '',
    model: {
      refId: 'C',
      type: 'threshold',
      datasource: ExpressionDatasourceRef,
      conditions: [
        {
          type: 'query',
          evaluator: {
            params: [0, 10],
            type: thresholdType ?? 'gt',
          },
        },
      ],
      expression: 'B',
    },
  };

  return [dataQuery, reduceExpression, thresholdExpression];
}
