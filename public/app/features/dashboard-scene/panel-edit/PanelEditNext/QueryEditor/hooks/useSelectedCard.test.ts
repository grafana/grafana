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
    it('should select nothing when no id is provided (useSelectionState supplies the queries[0] fallback upstream)', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should select the active query by refId', () => {
      const { result } = renderHook(() =>
        useSelectedCard('B', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should not select query when a transformation is active', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should not select query when an alert is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should not select query when an alert is selected even if an active query refId is set', () => {
      // selectAlert preserves activeQueryRefId so the user keeps their last query when they
      // return to the query view. The alert must still take precedence in the editor pane.
      const { result } = renderHook(() =>
        useSelectedCard('A', null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should not select query while a picker is pending even if an active query is set', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, null, mockQueries, mockTransformations, mockAlerts, true)
      );

      expect(result.current.selectedQuery).toBeNull();
    });

    it('should return null when the active refId does not exist', () => {
      const { result } = renderHook(() =>
        useSelectedCard('INVALID', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      // Ids arrive already resolved from useSelectionState, so an unknown id maps to nothing
      // rather than silently showing a different query.
      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for query when the queries array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(null, null, null, [], mockTransformations, mockAlerts));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('transformation selection', () => {
    it('should select the active transformation by id', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-2', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[1]);
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when none is active', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for transformation when an invalid id is provided', () => {
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

    it('should return null for alert when none is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard('A', null, null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[0]);
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when an invalid id is provided', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'INVALID', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });

    it('should return null for alert when the alerts array is empty', () => {
      const { result } = renderHook(() => useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, []));

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toBeNull();
      expect(result.current.selectedAlert).toBeNull();
    });
  });

  describe('cross-type behavior', () => {
    it('should prevent default query selection when a transformation is active', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
    });

    it('should prevent default query selection when an alert is selected', () => {
      const { result } = renderHook(() =>
        useSelectedCard(null, null, 'alert-1', mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toBeNull();
      expect(result.current.selectedAlert).toEqual(mockAlerts[0]);
    });

    it('should resolve both when activeQueryRefId and activeTransformationId are simultaneously set', () => {
      // useSelectionState enforces mutual exclusivity for the active ids, but useSelectedCard
      // itself does not — when both are provided, both resolve.
      const { result } = renderHook(() =>
        useSelectedCard('B', 'transform-1', null, mockQueries, mockTransformations, mockAlerts)
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);
      expect(result.current.selectedTransformation).toEqual(mockTransformations[0]);
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

      const newQueries: DataQuery[] = [
        { refId: 'B', datasource: { type: 'prometheus', uid: 'prom-2' } },
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

    it('should return null when the active query is removed from the array (useSelectionState re-resolves upstream)', () => {
      const { result, rerender } = renderHook(
        ({ queries }) => useSelectedCard('B', null, null, queries, mockTransformations, mockAlerts),
        {
          initialProps: { queries: mockQueries },
        }
      );

      expect(result.current.selectedQuery).toEqual(mockQueries[1]);

      const newQueries: DataQuery[] = [
        { refId: 'A', datasource: { type: 'prometheus', uid: 'prom-1' } },
        { refId: 'C', datasource: { type: 'loki', uid: 'loki-1' } },
      ];

      rerender({ queries: newQueries });

      expect(result.current.selectedQuery).toBeNull();
    });
  });
});
