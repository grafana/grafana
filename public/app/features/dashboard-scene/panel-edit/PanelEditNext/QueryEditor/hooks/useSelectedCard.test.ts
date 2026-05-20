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
    it('should highlight the first query by default when nothing is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toEqual(mockQueries[0]);
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should resolve the highlighted query by refId', () => {
      const { result } = renderHook(() =>
        useSelectedCard('B', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toEqual(mockQueries[1]);
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should not highlight a query when a transformation is highlighted', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toEqual(mockTransformations[0]);
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should not highlight a query when an alert is highlighted', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toEqual(mockAlerts[0]);
    });

    it('should not highlight a query when an alert is highlighted, even if a query ref is provided', () => {
      // Alert/picker takes precedence so the alert view actually activates.
      const { result } = renderHook(() =>
        useSelectedCard('A', null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toEqual(mockAlerts[0]);
    });

    it('should not highlight a query while a picker is pending', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, null, mockQueries, mockTransformations, mockAlerts, true)
      );

      expect(result.current.highlightedQuery).toBeNull();
    });

    it('should fall back to the first query when the highlighted refId does not exist', () => {
      const { result } = renderHook(() =>
        useSelectedCard('INVALID', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      // Highlight refId not found and no other exclusion — defaults to first query
      expect(result.current.highlightedQuery).toEqual(mockQueries[0]);
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should return null for query when queries array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(null, null, null, [], mockTransformations, mockAlerts));

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });
  });

  describe('transformation selection', () => {
    it('should resolve the highlighted transformation by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-2', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toEqual(mockTransformations[1]);
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should return null for transformation when not highlighted', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toEqual(mockQueries[0]);
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should return null for transformation when invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'INVALID', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should return null for transformation when transformations array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(null, 'transform-1', null, mockQueries, [], mockAlerts));

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });
  });

  describe('alert selection', () => {
    it('should resolve the highlighted alert by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'alert-2', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toEqual(mockAlerts[1]);
    });

    it('should return null for alert when not highlighted', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toEqual(mockQueries[0]);
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should return null for alert when invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'INVALID', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });

    it('should return null for alert when alerts array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, []));

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toBeNull();
      expect(result.current.highlightedAlert).toBeNull();
    });
  });

  describe('cross-type exclusivity', () => {
    it('should prevent default query highlight when transformation is highlighted', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedTransformation).toEqual(mockTransformations[0]);
    });

    it('should prevent default query highlight when alert is highlighted', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.highlightedQuery).toBeNull();
      expect(result.current.highlightedAlert).toEqual(mockAlerts[0]);
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

      expect(result.current.highlightedQuery).toEqual(mockQueries[1]);

      // Update queries
      const newQueries: DataQuery[] = [
        { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-2' } }, // Same refId, different data
        { refId: 'D', datasource: { type: 'graphite', uid: 'graphite-1' } },
      ];

      rerender({ queries: newQueries });

      expect(result.current.highlightedQuery).toEqual(newQueries[0]);
    });

    it('should update when transformations change', () => {
      const { result, rerender } = renderHook(
        ({ transformations }) => useSelectedCard(null, 'transform-1', null, mockQueries, transformations, mockAlerts),
        {
          initialProps: { transformations: mockTransformations },
        }
      );

      expect(result.current.highlightedTransformation).toEqual(mockTransformations[0]);

      const newTransformations: Transformation[] = [
        {
          transformId: 'transform-1',
          registryItem: undefined,
          transformConfig: { id: 'organize', options: { foo: 'bar' } },
        },
      ];

      rerender({ transformations: newTransformations });

      expect(result.current.highlightedTransformation).toEqual(newTransformations[0]);
    });

    it('should update when alerts change', () => {
      const { result, rerender } = renderHook(
        ({ alerts }) => useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, alerts),
        {
          initialProps: { alerts: mockAlerts },
        }
      );

      expect(result.current.highlightedAlert).toEqual(mockAlerts[0]);

      const newAlerts: AlertRule[] = [
        {
          alertId: 'alert-1',
          rule: mockCombinedRule({ name: 'Updated Alert' }),
          state: AlertState.Pending,
        },
      ];

      rerender({ alerts: newAlerts });

      expect(result.current.highlightedAlert).toEqual(newAlerts[0]);
    });

    it('should fall back to the first query when the highlighted query is removed from the array', () => {
      const { result, rerender } = renderHook(
        ({ queries }) => useSelectedCard('B', null, null, queries, mockTransformations, mockAlerts),
        {
          initialProps: { queries: mockQueries },
        }
      );

      expect(result.current.highlightedQuery).toEqual(mockQueries[1]);

      const newQueries: DataQuery[] = [
        { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
        { refId: 'C', datasource: { type: 'loki', uid: 'loki-1' } },
      ];

      rerender({ queries: newQueries });

      expect(result.current.highlightedQuery).toEqual(newQueries[0]);
    });
  });
});
