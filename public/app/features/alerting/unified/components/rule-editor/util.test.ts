import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { ClassicCondition, ExpressionQuery } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { NEW_REDUCER_REF } from './query-and-alert-condition/reducer';
import {
  containsPathSeparator,
  findRenamedDataQueryReferences,
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
      const rewiredQueries = queriesWithUpdatedReferences(queries, 'B', NEW_REDUCER_REF);

      const queryModel = rewiredQueries[2].model as ExpressionQuery;
      expect(queryModel.expression).toBe(NEW_REDUCER_REF);
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

describe('containsPathSeparator', () => {
  it('should return true for strings with /', () => {
    expect(containsPathSeparator('foo / bar')).toBe(true);
  });
  it('should return true for strings with \\', () => {
    expect(containsPathSeparator('foo \\ bar')).toBe(true);
  });
  it('should return false for strings without / or \\', () => {
    expect(containsPathSeparator('foo !@#$%^&*() <> [] {} bar')).toBe(false);
  });
});

describe('getThresholdsForQueries', () => {
  it('should work for threshold condition', () => {
    const [queries, condition] = createThresholdExample('gt');
    expect(getThresholdsForQueries(queries, condition)).toMatchSnapshot();
  });

  it('should work for classic_condition', () => {
    const [[dataQuery]] = createThresholdExample('gt');

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

    const thresholdsClassic = getThresholdsForQueries([dataQuery, classicCondition], classicCondition.refId);
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
      const thresholds = getThresholdsForQueries([dataQuery, classicCondition], classicCondition.refId);
      expect(thresholds).toStrictEqual({});
    }).not.toThrowError();
  });

  it('should work for within_range', () => {
    const [queries, condition] = createThresholdExample('within_range');
    const thresholds = getThresholdsForQueries(queries, condition);
    expect(thresholds).toMatchSnapshot();
  });

  it('should work for lt and gt', () => {
    const [gtQueries, qtCondition] = createThresholdExample('gt');
    const [ltQueries, ltCondition] = createThresholdExample('lt');
    expect(getThresholdsForQueries(gtQueries, qtCondition)).toMatchSnapshot();
    expect(getThresholdsForQueries(ltQueries, ltCondition)).toMatchSnapshot();
  });

  it('should work for outside_range', () => {
    const [queries, condition] = createThresholdExample('outside_range');
    const thresholds = getThresholdsForQueries(queries, condition);
    expect(thresholds).toMatchSnapshot();
  });
});

function createThresholdExample(thresholdType: string): [AlertQuery[], string] {
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

  return [[dataQuery, reduceExpression, thresholdExpression], thresholdExpression.refId];
}

describe('findRenamedReferences', () => {
  it('should find the renamed ids', () => {
    const previous = [{ refId: 'A' }, { refId: 'B' }, { refId: 'C' }] as AlertQuery[];
    const updated = [{ refId: 'FOO' }, { refId: 'B' }, { refId: 'C' }] as AlertQuery[];

    expect(findRenamedDataQueryReferences(previous, updated)).toEqual(['A', 'FOO']);
  });

  it('should ignore expression queries', () => {
    // @ts-expect-error
    const previous = [
      { refId: 'A' },
      { refId: 'REDUCE', model: { datasource: '-100' } },
      { refId: 'MATH', model: { datasource: '-100' } },
      { refId: 'B' },
      { refId: 'C' },
    ] as Array<AlertQuery<ExpressionQuery>>;

    // @ts-expect-error
    const updated = [
      { refId: 'FOO' },
      { refId: 'REDUCE', model: { datasource: '-100' } },
      { refId: 'B' },
      { refId: 'C' },
    ] as Array<AlertQuery<ExpressionQuery>>;

    expect(findRenamedDataQueryReferences(previous, updated)).toEqual(['A', 'FOO']);
  });
});
