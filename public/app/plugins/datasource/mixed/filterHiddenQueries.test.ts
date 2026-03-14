import { DataQuery } from '@grafana/data';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';

import { filterHiddenQueries } from './filterHiddenQueries';

describe('filterHiddenQueries', () => {
  describe('basic filtering', () => {
    it('returns all queries when none are hidden', () => {
      const queries: DataQuery[] = [
        { refId: 'A', hide: false },
        { refId: 'B', hide: false },
      ];
      expect(filterHiddenQueries(queries)).toEqual(queries);
    });

    it('filters out hidden queries', () => {
      const queries: DataQuery[] = [
        { refId: 'A', hide: true },
        { refId: 'B', hide: false },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId)).toEqual(['B']);
    });

    it('returns empty array when all queries are hidden', () => {
      const queries: DataQuery[] = [
        { refId: 'A', hide: true },
        { refId: 'B', hide: true },
      ];
      expect(filterHiddenQueries(queries)).toEqual([]);
    });
  });

  describe('dependency handling', () => {
    it('preserves hidden query referenced by Math expression', () => {
      const queries: Array<DataQuery | ExpressionQuery> = [
        { refId: 'A', hide: true },
        {
          refId: 'B',
          hide: false,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: '$A * 2',
          type: ExpressionQueryType.math,
        },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId).sort()).toEqual(['A', 'B']);
    });

    it('filters unreferenced hidden query when another is referenced', () => {
      const queries: Array<DataQuery | ExpressionQuery> = [
        { refId: 'A', hide: true }, // not referenced
        { refId: 'B', hide: true }, // referenced by C
        {
          refId: 'C',
          hide: false,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: '$B + 1',
          type: ExpressionQueryType.math,
        },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId).sort()).toEqual(['B', 'C']);
    });

    it('handles chain dependencies (A->B->C)', () => {
      const queries: Array<DataQuery | ExpressionQuery> = [
        { refId: 'A', hide: true },
        {
          refId: 'B',
          hide: true,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: '$A',
          type: ExpressionQueryType.reduce,
        },
        {
          refId: 'C',
          hide: false,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: '$B > 10',
          type: ExpressionQueryType.threshold,
        },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId).sort()).toEqual(['A', 'B', 'C']);
    });

    it('handles circular dependencies without infinite loop', () => {
      const queries: Array<DataQuery | ExpressionQuery> = [
        {
          refId: 'A',
          hide: true,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: '$B',
          type: ExpressionQueryType.math,
        },
        {
          refId: 'B',
          hide: true,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: '$A',
          type: ExpressionQueryType.math,
        },
        {
          refId: 'C',
          hide: false,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: '$A + $B',
          type: ExpressionQueryType.math,
        },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId).sort()).toEqual(['A', 'B', 'C']);
    });
  });

  describe('expression types', () => {
    it('preserves hidden query referenced by Resample expression', () => {
      const queries: Array<DataQuery | ExpressionQuery> = [
        { refId: 'A', hide: true },
        {
          refId: 'B',
          hide: false,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: '$A',
          type: ExpressionQueryType.resample,
          window: '1m',
          downsampler: 'mean',
          upsampler: 'pad',
        },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId).sort()).toEqual(['A', 'B']);
    });

    it('preserves hidden query referenced by SQL expression (FROM clause)', () => {
      const queries: Array<DataQuery | ExpressionQuery> = [
        { refId: 'A', hide: true },
        {
          refId: 'B',
          hide: false,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: 'SELECT * FROM A WHERE value > 0',
          type: ExpressionQueryType.sql,
        },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId).sort()).toEqual(['A', 'B']);
    });

    it('preserves multiple hidden queries referenced by SQL with JOINs', () => {
      const queries: Array<DataQuery | ExpressionQuery> = [
        { refId: 'A', hide: true },
        { refId: 'B', hide: true },
        {
          refId: 'C',
          hide: false,
          datasource: { uid: '__expr__', type: 'datasource' },
          expression: 'SELECT * FROM A JOIN B ON A.id = B.id',
          type: ExpressionQueryType.sql,
        },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId).sort()).toEqual(['A', 'B', 'C']);
    });

    it('preserves hidden query referenced by Classic Conditions', () => {
      const queries: Array<DataQuery | ExpressionQuery> = [
        { refId: 'A', hide: true },
        {
          refId: 'B',
          hide: false,
          datasource: { uid: '__expr__', type: 'datasource' },
          type: ExpressionQueryType.classic,
          conditions: [
            {
              evaluator: { params: [0], type: EvalFunction.IsAbove },
              query: { params: ['A'] },
              reducer: { params: [], type: 'avg' as const },
              type: 'query' as const,
            },
          ],
        },
      ];
      const result = filterHiddenQueries(queries);
      expect(result.map((q) => q.refId).sort()).toEqual(['A', 'B']);
    });
  });
});
