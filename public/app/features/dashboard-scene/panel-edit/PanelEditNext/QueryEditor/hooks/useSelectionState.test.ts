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
  onClearSideEffects: jest.fn(),
};

function setup(props: UseSelectionStateOptions = defaultProps) {
  return renderHook(() => useSelectionState(props));
}

describe('useSelectionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('query selection — plain click', () => {
    it('selects only that query', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      expect(result.current.selectedQueryRefIds).toEqual(['B']);
    });

    it('replaces any prior selection', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }));
      expect(result.current.selectedQueryRefIds).toEqual(['C']);
    });

    it('calls onClearSideEffects', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      expect(onClearSideEffects).toHaveBeenCalledTimes(1);
    });

    it('clears transformation selection (cross-type exclusivity)', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      expect(result.current.selectedTransformationIds).toEqual([]);
      expect(result.current.selectedQueryRefIds).toEqual(['A']);
    });
  });

  describe('query selection — Ctrl/Cmd multi-select', () => {
    it('adds a query to the selection', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { multi: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'C']);
    });

    it('removes a query that is already selected', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { multi: true }));
      act(() => result.current.toggleQuerySelection({ refId: 'A' }, { multi: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['C']);
    });

    it('does NOT call onClearSideEffects', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      onClearSideEffects.mockClear();
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { multi: true }));
      expect(onClearSideEffects).not.toHaveBeenCalled();
    });

    it('clears transformation selection (cross-type exclusivity)', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleQuerySelection({ refId: 'A' }, { multi: true }));
      expect(result.current.selectedTransformationIds).toEqual([]);
    });
  });

  describe('query selection — Shift range-select', () => {
    it('selects all queries between anchor and clicked query (forward)', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'D' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C', 'D']);
    });

    it('selects all queries between anchor and clicked query (backward)', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'D' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['B', 'C', 'D']);
    });

    it('anchors to the first query on initial load', () => {
      const { result } = setup();
      // First query is selected by default, so Shift+Click C range-selects A-C
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C']);
    });

    it('clears transformation selection (cross-type exclusivity)', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('uses queries[0] as implicit anchor after clearSelection', () => {
      const { result } = setup();
      act(() => result.current.clearSelection());
      expect(result.current.selectedQueryRefIds).toEqual([]);

      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C']);
    });

    it('uses queries[0] as implicit anchor when queries load after mount', () => {
      const emptyProps: UseSelectionStateOptions = { queries: [], transformations: mockTransformations };
      const { result, rerender } = renderHook((props: UseSelectionStateOptions) => useSelectionState(props), {
        initialProps: emptyProps,
      });
      expect(result.current.selectedQueryRefIds).toEqual([]);

      rerender({ queries: mockQueries, transformations: mockTransformations });

      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C']);
    });

    it('does not range-select when shift-clicking a query after selecting a transformation', () => {
      const { result } = setup();
      // Select a transformation (this clears query selection)
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      expect(result.current.selectedQueryRefIds).toEqual([]);
      // Shift+Click a query — should NOT range-select from first query, just plain select
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['C']);
    });
  });

  describe('transformation selection — plain click', () => {
    it('selects only that transformation', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[1]));
      expect(result.current.selectedTransformationIds).toEqual(['tx-1']);
    });

    it('replaces any prior selection', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2]));
      expect(result.current.selectedTransformationIds).toEqual(['tx-2']);
    });

    it('calls onClearSideEffects', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      expect(onClearSideEffects).toHaveBeenCalledTimes(1);
    });

    it('clears query selection (cross-type exclusivity)', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual(['tx-0']);
    });
  });

  describe('transformation selection — Ctrl/Cmd multi-select', () => {
    it('adds a transformation to the selection', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2], { multi: true }));
      expect(result.current.selectedTransformationIds).toEqual(['tx-0', 'tx-2']);
    });

    it('removes a transformation that is already selected', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2], { multi: true }));
      act(() => result.current.toggleTransformationSelection(mockTransformations[0], { multi: true }));
      expect(result.current.selectedTransformationIds).toEqual(['tx-2']);
    });
  });

  describe('transformation selection — Shift range-select', () => {
    it('selects all transformations between anchor and clicked transformation', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2], { range: true }));
      expect(result.current.selectedTransformationIds).toEqual(['tx-0', 'tx-1', 'tx-2']);
    });

    it('falls back to plain click when no prior transformation is selected', () => {
      const { result } = setup();
      // Range with no existing selection: anchor lookup fails, falls through to plain click
      act(() => result.current.toggleTransformationSelection(mockTransformations[1], { range: true }));
      expect(result.current.selectedTransformationIds).toEqual(['tx-1']);
    });
  });

  describe('clearSelection', () => {
    it('resets all selections to empty', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { multi: true }));
      act(() => result.current.clearSelection());
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('calls onClearSideEffects', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      act(() => result.current.clearSelection());
      expect(onClearSideEffects).toHaveBeenCalled();
    });
  });

  describe('onCardSelectionChange', () => {
    it('sets query selection and clears transformations', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.onCardSelectionChange('A', null));
      expect(result.current.selectedQueryRefIds).toEqual(['A']);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('sets transformation selection and clears queries', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.onCardSelectionChange(null, 'tx-0'));
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual(['tx-0']);
    });

    it('clears both when both args are null', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.onCardSelectionChange(null, null));
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });
  });

  describe('trackQueryRename', () => {
    it('updates the renamed refId in the selection', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.trackQueryRename('A', 'A2'));
      expect(result.current.selectedQueryRefIds).toEqual(['A2']);
    });

    it('only updates the renamed refId when multiple queries are selected', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { multi: true }));
      act(() => result.current.trackQueryRename('A', 'A_renamed'));
      expect(result.current.selectedQueryRefIds).toEqual(['A_renamed', 'B']);
    });
  });
});
