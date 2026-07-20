import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { type ClassicCondition, type ExpressionQuery, ExpressionQueryType } from '../types';

import { defaultCondition, getDefaults } from './expressionTypes';

describe('getDefaults', () => {
  describe('classic expression type', () => {
    it('should create default conditions when conditions is undefined', () => {
      const query = {
        type: ExpressionQueryType.classic,
        refId: 'A',
      } as ExpressionQuery;

      const result = getDefaults(query);
      expect(result.conditions).toEqual([defaultCondition]);
    });

    it('should backfill missing reducer in existing conditions', () => {
      const query = {
        type: ExpressionQueryType.classic,
        refId: 'A',
        conditions: [
          {
            type: 'query',
            evaluator: { params: [0], type: EvalFunction.IsAbove },
            query: { params: ['A'] },
          } satisfies ClassicCondition,
        ],
      } as ExpressionQuery;

      const result = getDefaults(query);
      expect(result.conditions![0].reducer).toEqual({ params: [], type: 'avg' });
    });

    it('should not overwrite an existing reducer', () => {
      const query = {
        type: ExpressionQueryType.classic,
        refId: 'A',
        conditions: [
          {
            type: 'query',
            evaluator: { params: [0], type: EvalFunction.IsAbove },
            query: { params: ['A'] },
            reducer: { params: [], type: 'max' },
          },
        ],
      } as ExpressionQuery;

      const result = getDefaults(query);
      expect(result.conditions?.[0].reducer?.type).toBe('max');
    });

    it('should handle a mix of conditions with and without reducer', () => {
      const query = {
        type: ExpressionQueryType.classic,
        refId: 'A',
        conditions: [
          {
            type: 'query',
            evaluator: { params: [0], type: EvalFunction.IsAbove },
            query: { params: ['A'] },
            reducer: { params: [], type: 'sum' },
          },
          {
            type: 'query',
            evaluator: { params: [0], type: EvalFunction.IsAbove },
            query: { params: ['B'] },
          } satisfies ClassicCondition,
        ],
      } as ExpressionQuery;

      const result = getDefaults(query);
      expect(result.conditions?.[0]?.reducer?.type).toBe('sum');
      expect(result.conditions?.[1]?.reducer).toEqual({ params: [], type: 'avg' });
    });
  });

  describe('reduce expression type', () => {
    it('should set default reducer when missing', () => {
      const query = {
        type: ExpressionQueryType.reduce,
        refId: 'A',
      } as ExpressionQuery;

      const result = getDefaults(query);
      expect(result.reducer).toBe('mean');
    });

    it('should not overwrite existing reducer', () => {
      const query = {
        type: ExpressionQueryType.reduce,
        refId: 'A',
        reducer: 'max',
      } as ExpressionQuery;

      const result = getDefaults(query);
      expect(result.reducer).toBe('max');
    });
  });
});
