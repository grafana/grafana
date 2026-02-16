import { renderHook } from '@testing-library/react';

import { AlertState } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { mockCombinedRule } from 'app/features/alerting/unified/mocks';

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

  describe('query selection', () => {
    it('should select first query by default when nothing is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should select specific query by refId', () => {
      const { result } = renderHook(() =>
        useSelectedCard('B', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should not select query when transformation is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should not select query when alert is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should return null for query when invalid refId is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard('INVALID', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      // When refId doesn't exist and no transformation/alert selected, defaults to first query
      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for query when queries array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(null, null, null, [], mockTransformations, mockAlerts));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should prioritize explicit query selection over default', () => {
      const { result } = renderHook(() =>
        useSelectedCard('C', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[2]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('transformation selection', () => {
    it('should select specific transformation by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-2', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[1]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when not selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'INVALID', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when transformations array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(null, 'transform-1', null, mockQueries, [], mockAlerts));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('alert selection', () => {
    it('should select specific alert by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'alert-2', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[1]);
    });

    it('should return null for alert when not selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'INVALID', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when alerts array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, []));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('query selection exclusivity', () => {
    it('should prevent default query selection when transformation is selected without explicit query', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      // Transformation prevents default query selection
      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
    });

    it('should prevent default query selection when alert is selected without explicit query', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      // Alert prevents default query selection
      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should allow explicit query selection even when transformation is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard('B', 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      // Explicit query refId overrides the exclusivity rule
      expect(result.current.selectedQuery).toEqual(mockQueries[1]);
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
    });
  });

  describe('selection behavior with multiple ids', () => {
    it('should select both query and transformation when both ids are provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      // Both are selected - explicit query refId allows both to be selected
      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should select both query and alert when both ids are provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      // Both are selected - explicit query refId allows both to be selected
      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should select all three when all ids are provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', 'transform-1', 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      // All three can be selected simultaneously when explicit query refId is provided
      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });
  });

  describe('updates and reactivity', () => {
    it('should update when queries change', () => {
      const { result, rerender } = renderHook(
        ({ queries }) => useSelectedCard('B', null, null, queries, mockTransformations, mockAlerts),
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
        ({ transformations }) => useSelectedCard(null, 'transform-1', null, mockQueries, transformations, mockAlerts),
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
        ({ alerts }) => useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, alerts),
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
        ({ queries }) => useSelectedCard('B', null, null, queries, mockTransformations, mockAlerts),
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
