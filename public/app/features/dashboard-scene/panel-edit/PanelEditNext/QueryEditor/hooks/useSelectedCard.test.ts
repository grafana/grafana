import { renderHook } from '@testing-library/react';

import { AlertState } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { mockCombinedRule } from 'app/features/alerting/unified/mocks';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';

import { ActiveContext, DataSelection } from '../QueryEditorContext';
import { AlertRule, Transformation } from '../types';

import { useSelectedCard } from './useSelectedCard';

describe('useSelectedCard', () => {
  const mockQueries: DataQuery[] = [
    { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
    { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-1' } },
    { refId: 'C', datasource: { type: 'loki', uid: 'loki-1' } },
  ];

  const mockTransformations: Transformation[] = [
    { transformId: 'transform-1', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
    { transformId: 'transform-2', registryItem: undefined, transformConfig: { id: 'reduce', options: {} } },
  ];

  const mockAlerts: AlertRule[] = [
    {
      alertId: 'alert-1',
      rule: mockCombinedRule({ name: 'High CPU Alert' }),
      state: AlertState.Alerting,
    },
    {
      alertId: 'alert-2',
      rule: mockCombinedRule({ name: 'Memory Alert' }),
      state: AlertState.OK,
    },
  ];

  const dataCtx = (selection: DataSelection = { kind: 'none' }): ActiveContext => ({
    view: 'data',
    selection,
  });

  const alertsCtx = (alertId: string | null = null): ActiveContext => ({
    view: 'alerts',
    alertId,
  });

  const mockExpressionQueries: ExpressionQuery[] = [
    { refId: 'EXP-A', type: ExpressionQueryType.math, datasource: { type: '__expr__', uid: '__expr__' } },
    { refId: 'EXP-B', type: ExpressionQueryType.reduce, datasource: { type: '__expr__', uid: '__expr__' } },
  ];

  const mixedQueries: DataQuery[] = [
    { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
    { refId: 'EXP-A', type: ExpressionQueryType.math, datasource: { type: '__expr__', uid: '__expr__' } } as DataQuery,
  ];

  describe('query selection', () => {
    it('should select first query by default when nothing is explicitly selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx(), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should select specific query by refId', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx({ kind: 'query', refId: 'B' }), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should not select query when transformation is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'transformation', id: 'transform-1' }),
          mockQueries,
          mockTransformations,
          mockAlerts
        )
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should not select query when in alerts view', () => {
      const { result } = renderHook(() =>
        useSelectedCard(alertsCtx('alert-1'), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should fall back to first query when invalid refId is provided and no transformation selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx({ kind: 'query', refId: 'INVALID' }), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for query when queries array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(dataCtx(), [], mockTransformations, mockAlerts));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should prioritize explicit query selection over default', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx({ kind: 'query', refId: 'C' }), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[2]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('transformation selection', () => {
    it('should select specific transformation by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'transformation', id: 'transform-2' }),
          mockQueries,
          mockTransformations,
          mockAlerts
        )
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[1]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when not selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx({ kind: 'query', refId: 'A' }), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'transformation', id: 'INVALID' }),
          mockQueries,
          mockTransformations,
          mockAlerts
        )
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when transformations array is empty', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx({ kind: 'transformation', id: 'transform-1' }), mockQueries, [], mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('picker states', () => {
    it('expressionPicker: no query, transformation, or alert is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'expressionPicker', insertAfter: 'A' }),
          mockQueries,
          mockTransformations,
          mockAlerts
        )
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('transformationPicker: no query, transformation, or alert is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'transformationPicker', insertAfter: 'transform-1' }),
          mockQueries,
          mockTransformations,
          mockAlerts
        )
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('expression selection', () => {
    it('should return selectedExpression and null selectedQuery for kind=expression', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'expression', refId: 'EXP-A' }),
          mockExpressionQueries as DataQuery[],
          mockTransformations,
          mockAlerts
        )
      );

      expect(result.current.selectedExpression).toEqual(mockExpressionQueries[0]);
      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for expression when refId does not match', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'expression', refId: 'INVALID' }),
          mockExpressionQueries as DataQuery[],
          mockTransformations,
          mockAlerts
        )
      );

      expect(result.current.selectedExpression).toBeNull();
      expect(result.current.selectedQuery).toBeNull();
    });

    it('should return null for expression when queries array is empty', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx({ kind: 'expression', refId: 'EXP-A' }), [], mockTransformations, mockAlerts)
      );

      expect(result.current.selectedExpression).toBeNull();
      expect(result.current.selectedQuery).toBeNull();
    });

    it('should not fall back to first query when expression selection yields no match', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'expression', refId: 'INVALID' }),
          mockQueries,
          mockTransformations,
          mockAlerts
        )
      );

      // No fallback for expression kind — selectedQuery stays null
      expect(result.current.selectedExpression).toBeNull();
      expect(result.current.selectedQuery).toBeNull();
    });

    it('should select non-expression query as default when kind=none and only non-expression queries exist', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx(), mixedQueries, mockTransformations, mockAlerts)
      );

      // Falls back to first non-expression query, not the expression
      expect(result.current.selectedQuery).toEqual(mixedQueries[0]);
      expect(result.current.selectedExpression).toBeNull();
    });
  });

  describe('alert selection', () => {
    it('should select specific alert by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard(alertsCtx('alert-2'), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[1]);
    });

    it('should return null for alert when in data view', () => {
      const { result } = renderHook(() =>
        useSelectedCard(dataCtx({ kind: 'query', refId: 'A' }), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when alertId is null in alerts view (no alerts exist)', () => {
      const { result } = renderHook(() =>
        useSelectedCard(alertsCtx(null), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard(alertsCtx('INVALID'), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when alerts array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(alertsCtx('alert-1'), mockQueries, mockTransformations, []));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('mutual exclusivity enforced by DataSelection', () => {
    it('data view: transformation selection prevents default query selection', () => {
      const { result } = renderHook(() =>
        useSelectedCard(
          dataCtx({ kind: 'transformation', id: 'transform-1' }),
          mockQueries,
          mockTransformations,
          mockAlerts
        )
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('alerts view: never resolves a query or transformation', () => {
      const { result } = renderHook(() =>
        useSelectedCard(alertsCtx('alert-1'), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('alerts view with no alertId: all resolved values are null', () => {
      const { result } = renderHook(() =>
        useSelectedCard(alertsCtx(null), mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('updates and reactivity', () => {
    it('should update when queries change', () => {
      const { result, rerender } = renderHook(
        ({ queries }) => useSelectedCard(dataCtx({ kind: 'query', refId: 'B' }), queries, mockTransformations, mockAlerts),
        { initialProps: { queries: mockQueries } }
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);

      const newQueries: DataQuery[] = [
        { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-2' } },
        { refId: 'D', datasource: { type: 'graphite', uid: 'graphite-1' } },
      ];

      rerender({ queries: newQueries });

      expect(result.current.selectedQuery).toEqual(newQueries[0]);
    });

    it('should update when transformations change', () => {
      const { result, rerender } = renderHook(
        ({ transformations }) =>
          useSelectedCard(
            dataCtx({ kind: 'transformation', id: 'transform-1' }),
            mockQueries,
            transformations,
            mockAlerts
          ),
        { initialProps: { transformations: mockTransformations } }
      );

      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);

      const newTransformations: Transformation[] = [
        {
          transformId: 'transform-1',
          registryItem: undefined,
          transformConfig: { id: 'organize', options: { foo: 'bar' } },
        },
      ];

      rerender({ transformations: newTransformations });

      expect(result.current.selectedTransformation).toEqual(newTransformations[0]);
    });

    it('should update when alerts change', () => {
      const { result, rerender } = renderHook(
        ({ alerts }) => useSelectedCard(alertsCtx('alert-1'), mockQueries, mockTransformations, alerts),
        { initialProps: { alerts: mockAlerts } }
      );

      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);

      const newAlerts: AlertRule[] = [
        {
          alertId: 'alert-1',
          rule: mockCombinedRule({ name: 'Updated Alert' }),
          state: AlertState.Pending,
        },
      ];

      rerender({ alerts: newAlerts });

      expect(result.current.selectedAlert).toEqual(newAlerts[0]);
    });

    it('should fall back to first query when selected query is removed from array', () => {
      const { result, rerender } = renderHook(
        ({ queries }) => useSelectedCard(dataCtx({ kind: 'query', refId: 'B' }), queries, mockTransformations, mockAlerts),
        { initialProps: { queries: mockQueries } }
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);

      const newQueries: DataQuery[] = [
        { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
        { refId: 'C', datasource: { type: 'loki', uid: 'loki-1' } },
      ];

      rerender({ queries: newQueries });

      expect(result.current.selectedQuery).toEqual(newQueries[0]);
    });
  });
});
