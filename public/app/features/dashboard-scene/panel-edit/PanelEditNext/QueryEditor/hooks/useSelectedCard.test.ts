import { renderHook } from '@testing-library/react';

import { AlertState } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';
import { mockCombinedRule } from 'app/features/alerting/unified/mocks';

import { type AlertRule, type Transformation } from '../types';

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

  describe('query selection', () => {
    it('should select first query by default when nothing is selected', () => {
      const { result } = renderHook(() => useSelectedCard([], [], null, mockQueries, mockTransformations, mockAlerts));

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should select specific query by refId (last in array = primary)', () => {
      const { result } = renderHook(() =>
        useSelectedCard(['B'], [], null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should select the last refId in the array as the primary query', () => {
      const { result } = renderHook(() =>
        useSelectedCard(['A', 'C'], [], null, mockQueries, mockTransformations, mockAlerts)
      );

      // Last element (C) is primary
      expect(result.current.selectedQuery).toEqual(mockQueries[2]);
    });

    it('should not select query when transformation is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], ['transform-1'], null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should not select query when alert is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], [], 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should fall back to first query when primary refId does not exist', () => {
      const { result } = renderHook(() =>
        useSelectedCard(['INVALID'], [], null, mockQueries, mockTransformations, mockAlerts)
      );

      // Primary refId not found and no other exclusion — defaults to first query
      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for query when queries array is empty', () => {
      const { result } = renderHook(() => useSelectedCard([], [], null, [], mockTransformations, mockAlerts));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should prioritize explicit query selection over default', () => {
      const { result } = renderHook(() =>
        useSelectedCard(['C'], [], null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[2]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should use the last refId in the array as the primary query when multiple are selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(['A', 'B', 'C'], [], null, mockQueries, mockTransformations, mockAlerts)
      );
      // Primary (shown in editor) is the last element: C
      expect(result.current.selectedQuery).toEqual(mockQueries[2]);
    });
  });

  describe('transformation selection', () => {
    it('should select specific transformation by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], ['transform-2'], null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[1]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should select the last transformation id in array as primary', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], ['transform-1', 'transform-2'], null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedTransformation).toEqual(mockTransformations[1]);
    });

    it('should return null for transformation when not selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(['A'], [], null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], ['INVALID'], null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when transformations array is empty', () => {
      const { result } = renderHook(() => useSelectedCard([], ['transform-1'], null, mockQueries, [], mockAlerts));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should use the last transformId as the primary when multiple transformations are selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], ['transform-2', 'transform-1'], null, mockQueries, mockTransformations, mockAlerts)
      );
      // Primary is last: transform-1, which is mockTransformations[0]
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
    });
  });

  describe('alert selection', () => {
    it('should select specific alert by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], [], 'alert-2', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[1]);
    });

    it('should return null for alert when not selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(['A'], [], null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], [], 'INVALID', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when alerts array is empty', () => {
      const { result } = renderHook(() => useSelectedCard([], [], 'alert-1', mockQueries, mockTransformations, []));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('query selection exclusivity', () => {
    it('should prevent default query selection when transformation is selected without explicit query', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], ['transform-1'], null, mockQueries, mockTransformations, mockAlerts)
      );

      // Transformation prevents default query selection
      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
    });

    it('should prevent default query selection when alert is selected without explicit query', () => {
      const { result } = renderHook(() =>
        useSelectedCard([], [], 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      // Alert prevents default query selection
      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should allow explicit query selection even when transformation is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(['B'], ['transform-1'], null, mockQueries, mockTransformations, mockAlerts)
      );

      // Explicit query refId overrides the exclusivity rule
      expect(result.current.selectedQuery).toEqual(mockQueries[1]);
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
    });
  });

  describe('updates and reactivity', () => {
    it('should update when queries change', () => {
      const { result, rerender } = renderHook(
        ({ queries }) => useSelectedCard(['B'], [], null, queries, mockTransformations, mockAlerts),
        {
          initialProps: { queries: mockQueries },
        }
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);

      // Update queries
      const newQueries: DataQuery[] = [
        { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-2' } }, // Same refId, different data
        { refId: 'D', datasource: { type: 'graphite', uid: 'graphite-1' } },
      ];

      rerender({ queries: newQueries });

      expect(result.current.selectedQuery).toEqual(newQueries[0]);
    });

    it('should update when transformations change', () => {
      const { result, rerender } = renderHook(
        ({ transformations }) => useSelectedCard([], ['transform-1'], null, mockQueries, transformations, mockAlerts),
        {
          initialProps: { transformations: mockTransformations },
        }
      );

      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);

      // Update transformations
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
        ({ alerts }) => useSelectedCard([], [], 'alert-1', mockQueries, mockTransformations, alerts),
        {
          initialProps: { alerts: mockAlerts },
        }
      );

      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);

      // Update alerts
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

    it('should handle selected item being removed from array', () => {
      const { result, rerender } = renderHook(
        ({ queries }) => useSelectedCard(['B'], [], null, queries, mockTransformations, mockAlerts),
        {
          initialProps: { queries: mockQueries },
        }
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);

      // Remove query B from array
      const newQueries: DataQuery[] = [
        { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
        { refId: 'C', datasource: { type: 'loki', uid: 'loki-1' } },
      ];

      rerender({ queries: newQueries });

      // Should fall back to first query
      expect(result.current.selectedQuery).toEqual(newQueries[0]);
    });
  });
});
