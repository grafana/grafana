import { act, renderHook } from '@testing-library/react';

import { type DataQuery } from '@grafana/schema';

import { type Transformation } from '../types';

import { useSelectionState, type UseSelectionStateOptions } from './useSelectionState';

const mockQueries: DataQuery[] = [{ refId: 'A' }, { refId: 'B' }, { refId: 'C' }, { refId: 'D' }];

const mockTransformations: Transformation[] = [
  { transformId: 'tx-0', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
  { transformId: 'tx-1', registryItem: undefined, transformConfig: { id: 'reduce', options: {} } },
  { transformId: 'tx-2', registryItem: undefined, transformConfig: { id: 'filter', options: {} } },
];

const defaultProps: UseSelectionStateOptions = {
  queries: mockQueries,
  transformations: mockTransformations,
};

function setup(props: UseSelectionStateOptions = defaultProps) {
  return renderHook(() => useSelectionState(props));
}

describe('useSelectionState', () => {
  describe('active card selection', () => {
    it('defaults the active query to the first query', () => {
      const { result } = setup();

      expect(result.current.activeQueryRefId).toBe('A');
      expect(result.current.activeTransformationId).toBeNull();
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('sets the active query without changing bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.onCardSelectionChange('C', null));

      expect(result.current.activeQueryRefId).toBe('C');
      expect(result.current.activeTransformationId).toBeNull();
      expect(result.current.selectedQueryRefIds).toEqual(['B']);
    });

    it('sets the active transformation without changing bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.onCardSelectionChange(null, 'tx-1'));

      expect(result.current.activeQueryRefId).toBeNull();
      expect(result.current.activeTransformationId).toBe('tx-1');
      expect(result.current.selectedQueryRefIds).toEqual(['B']);
    });

    it('clears active selection when both active ids are null', () => {
      const { result } = setup();

      act(() => result.current.onCardSelectionChange(null, null));

      expect(result.current.activeQueryRefId).toBeNull();
      expect(result.current.activeTransformationId).toBeNull();
    });
  });

  describe('query bulk selection', () => {
    it('toggles a query into the bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleQuerySelection({ refId: 'B' }));

      expect(result.current.selectedQueryRefIds).toEqual(['B']);
      expect(result.current.activeQueryRefId).toBe('A');
    });

    it('toggles a query out of the bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));

      expect(result.current.selectedQueryRefIds).toEqual([]);
    });

    it('clears transformation bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));

      expect(result.current.selectedTransformationIds).toEqual([]);
      expect(result.current.selectedQueryRefIds).toEqual(['B']);
    });

    it('range-selects from the active query when no query is checked yet', () => {
      const { result } = setup();

      act(() => result.current.toggleQuerySelection({ refId: 'D' }, { range: true }));

      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C', 'D']);
    });

    it('range-selects from the last checked query', () => {
      const { result } = setup();

      act(() => result.current.toggleQuerySelection({ refId: 'D' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { range: true }));

      expect(result.current.selectedQueryRefIds).toEqual(['B', 'C', 'D']);
    });

    it('uses the first query as range anchor when queries load after mount', () => {
      const emptyProps: UseSelectionStateOptions = { queries: [], transformations: mockTransformations };
      const { result, rerender } = renderHook((props: UseSelectionStateOptions) => useSelectionState(props), {
        initialProps: emptyProps,
      });

      rerender({ queries: mockQueries, transformations: mockTransformations });
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));

      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C']);
    });
  });

  describe('transformation bulk selection', () => {
    it('toggles a transformation into the bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleTransformationSelection(mockTransformations[1]));

      expect(result.current.selectedTransformationIds).toEqual(['tx-1']);
      expect(result.current.activeQueryRefId).toBe('A');
    });

    it('toggles a transformation out of the bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleTransformationSelection(mockTransformations[1]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[1]));

      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('clears query bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));

      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual(['tx-0']);
    });

    it('range-selects from the active transformation when no transformation is checked yet', () => {
      const { result } = setup();

      act(() => result.current.onCardSelectionChange(null, 'tx-0'));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2], { range: true }));

      expect(result.current.selectedTransformationIds).toEqual(['tx-0', 'tx-1', 'tx-2']);
    });
  });

  describe('multi-select entry and clear', () => {
    it('preselects the active query when entering multi-select mode', () => {
      const { result } = setup();

      act(() => result.current.onCardSelectionChange('C', null));
      act(() => result.current.setSelectionFromActiveCard());

      expect(result.current.selectedQueryRefIds).toEqual(['C']);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('preselects the active transformation when entering multi-select mode', () => {
      const { result } = setup();

      act(() => result.current.onCardSelectionChange(null, 'tx-2'));
      act(() => result.current.setSelectionFromActiveCard());

      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual(['tx-2']);
    });

    it('clears only bulk selection', () => {
      const { result } = setup();

      act(() => result.current.onCardSelectionChange('C', null));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.clearSelection());

      expect(result.current.activeQueryRefId).toBe('C');
      expect(result.current.selectedQueryRefIds).toEqual([]);
    });
  });

  describe('trackQueryRename', () => {
    it('updates the renamed refId in active and bulk selection', () => {
      const { result } = setup();

      act(() => result.current.onCardSelectionChange('A', null));
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.trackQueryRename('A', 'A2'));

      expect(result.current.activeQueryRefId).toBe('A2');
      expect(result.current.selectedQueryRefIds).toEqual(['A2']);
    });

    it('only updates the renamed refId in bulk selection', () => {
      const { result } = setup();

      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.trackQueryRename('A', 'A_renamed'));

      expect(result.current.selectedQueryRefIds).toEqual(['A_renamed', 'B']);
    });
  });
});
