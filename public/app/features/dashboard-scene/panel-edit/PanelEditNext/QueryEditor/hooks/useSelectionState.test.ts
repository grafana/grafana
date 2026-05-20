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

  describe('initial state', () => {
    it('highlights the first query by default', () => {
      const { result } = setup();
      expect(result.current.anchorQueryRefId).toBe('A');
      expect(result.current.anchorTransformationId).toBeNull();
    });

    it('starts with empty selection sets (multi-select is off by default)', () => {
      const { result } = setup();
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('leaves highlight empty when there are no queries', () => {
      const { result } = setup({ ...defaultProps, queries: [] });
      expect(result.current.anchorQueryRefId).toBeNull();
    });
  });

  describe('selectQuery', () => {
    it('sets the highlight to the clicked query', () => {
      const { result } = setup();
      act(() => result.current.selectQuery({ refId: 'B' }));
      expect(result.current.anchorQueryRefId).toBe('B');
    });

    it('does not touch the query selection set', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'C']);

      act(() => result.current.selectQuery({ refId: 'B' }));

      expect(result.current.selectedQueryRefIds).toEqual(['A', 'C']);
      expect(result.current.anchorQueryRefId).toBe('B');
    });

    it('clears transformation highlight and selection (cross-type exclusivity)', () => {
      const { result } = setup();
      act(() => result.current.selectTransformation(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[1]));
      expect(result.current.anchorTransformationId).toBe('tx-0');
      expect(result.current.selectedTransformationIds).toEqual(['tx-1']);

      act(() => result.current.selectQuery({ refId: 'B' }));

      expect(result.current.anchorTransformationId).toBeNull();
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('calls onClearSideEffects', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      act(() => result.current.selectQuery({ refId: 'A' }));
      expect(onClearSideEffects).toHaveBeenCalledTimes(1);
    });
  });

  describe('selectTransformation', () => {
    it('sets the highlight to the clicked transformation', () => {
      const { result } = setup();
      act(() => result.current.selectTransformation(mockTransformations[1]));
      expect(result.current.anchorTransformationId).toBe('tx-1');
    });

    it('clears query highlight and selection (cross-type exclusivity)', () => {
      const { result } = setup();
      // A query is highlighted by default and we can also populate selection.
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      expect(result.current.anchorQueryRefId).toBe('A');
      expect(result.current.selectedQueryRefIds).toEqual(['B']);

      act(() => result.current.selectTransformation(mockTransformations[0]));

      expect(result.current.anchorQueryRefId).toBeNull();
      expect(result.current.selectedQueryRefIds).toEqual([]);
    });
  });

  describe('toggleQuerySelection — plain toggle', () => {
    it('adds a query to the selection set', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      expect(result.current.selectedQueryRefIds).toEqual(['B']);
    });

    it('removes a query already in the selection set', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }));
      expect(result.current.selectedQueryRefIds).toEqual(['B', 'C']);

      act(() => result.current.toggleQuerySelection({ refId: 'B' }));

      expect(result.current.selectedQueryRefIds).toEqual(['C']);
    });

    it('does not change the highlight', () => {
      const { result } = setup();
      const beforeHighlight = result.current.anchorQueryRefId;
      act(() => result.current.toggleQuerySelection({ refId: 'D' }));
      expect(result.current.anchorQueryRefId).toBe(beforeHighlight);
    });

    it('allows emptying the selection set entirely', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      expect(result.current.selectedQueryRefIds).toEqual([]);
    });
  });

  describe('toggleQuerySelection — Shift range-select', () => {
    it('selects all queries between the last toggle and the clicked one (forward)', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'D' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C', 'D']);
    });

    it('selects all queries between the last toggle and the clicked one (backward)', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'D' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['B', 'C', 'D']);
    });

    it('uses the highlight as the anchor when the selection set is empty', () => {
      const { result } = setup();
      // Highlight defaults to 'A'; selection set is empty.
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C']);
    });
  });

  describe('toggleTransformationSelection', () => {
    it('toggles a transformation in/out of the selection set', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2]));
      expect(result.current.selectedTransformationIds).toEqual(['tx-0', 'tx-2']);

      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      expect(result.current.selectedTransformationIds).toEqual(['tx-2']);
    });

    it('does not change the transformation highlight', () => {
      const { result } = setup();
      act(() => result.current.selectTransformation(mockTransformations[1]));
      const beforeHighlight = result.current.anchorTransformationId;

      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));

      expect(result.current.anchorTransformationId).toBe(beforeHighlight);
    });

    it('range-selects between the last toggle and the clicked one', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2], { range: true }));
      expect(result.current.selectedTransformationIds).toEqual(['tx-0', 'tx-1', 'tx-2']);
    });
  });

  describe('seedSelectionWithHighlight', () => {
    it('seeds the query selection set with the currently highlighted query', () => {
      const { result } = setup();
      act(() => result.current.selectQuery({ refId: 'C' }));
      expect(result.current.selectedQueryRefIds).toEqual([]);

      act(() => result.current.seedSelectionWithHighlight());

      expect(result.current.selectedQueryRefIds).toEqual(['C']);
    });

    it('seeds the transformation selection set when a transformation is highlighted', () => {
      const { result } = setup();
      act(() => result.current.selectTransformation(mockTransformations[1]));
      act(() => result.current.seedSelectionWithHighlight());

      expect(result.current.selectedTransformationIds).toEqual(['tx-1']);
      expect(result.current.selectedQueryRefIds).toEqual([]);
    });
  });

  describe('clearSelection', () => {
    it('empties both selection sets', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.clearSelection());
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('leaves the highlight untouched when it points to a still-existing query', () => {
      const { result } = setup();
      act(() => result.current.selectQuery({ refId: 'C' }));
      act(() => result.current.clearSelection());
      expect(result.current.anchorQueryRefId).toBe('C');
    });

    it('falls back the highlight to queries[0] when the highlighted query no longer exists', () => {
      // Simulates the bulk-delete case where the highlighted card was removed.
      const { result, rerender } = renderHook((props: UseSelectionStateOptions) => useSelectionState(props), {
        initialProps: defaultProps,
      });

      act(() => result.current.selectQuery({ refId: 'D' }));

      // 'D' got bulk-deleted from queries.
      rerender({ ...defaultProps, queries: mockQueries.slice(0, 3) });
      act(() => result.current.clearSelection());

      expect(result.current.anchorQueryRefId).toBe('A');
    });
  });

  describe('removeQueryFromSelection', () => {
    it('removes from the selection set', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));

      act(() => result.current.removeQueryFromSelection('A'));

      expect(result.current.selectedQueryRefIds).toEqual(['B']);
    });

    it('also clears the highlight when it pointed at the removed query', () => {
      const { result } = setup();
      act(() => result.current.selectQuery({ refId: 'C' }));
      act(() => result.current.removeQueryFromSelection('C'));
      expect(result.current.anchorQueryRefId).toBeNull();
    });

    it('leaves the highlight alone when removing a different query', () => {
      const { result } = setup();
      act(() => result.current.selectQuery({ refId: 'C' }));
      act(() => result.current.removeQueryFromSelection('A'));
      expect(result.current.anchorQueryRefId).toBe('C');
    });
  });

  describe('onCardSelectionChange (programmatic full reset)', () => {
    it('sets the query highlight and clears everything else', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.selectTransformation(mockTransformations[0]));

      act(() => result.current.onCardSelectionChange('A', null));

      expect(result.current.anchorQueryRefId).toBe('A');
      expect(result.current.anchorTransformationId).toBeNull();
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('sets the transformation highlight and clears queries', () => {
      const { result } = setup();
      act(() => result.current.onCardSelectionChange(null, 'tx-0'));
      expect(result.current.anchorTransformationId).toBe('tx-0');
      expect(result.current.anchorQueryRefId).toBeNull();
    });

    it('clears everything when both args are null', () => {
      const { result } = setup();
      act(() => result.current.onCardSelectionChange(null, null));
      expect(result.current.anchorQueryRefId).toBeNull();
      expect(result.current.anchorTransformationId).toBeNull();
    });
  });

  describe('trackQueryRename', () => {
    it('updates the renamed refId in the highlight', () => {
      const { result } = setup();
      act(() => result.current.selectQuery({ refId: 'A' }));
      act(() => result.current.trackQueryRename('A', 'A2'));
      expect(result.current.anchorQueryRefId).toBe('A2');
    });

    it('updates the renamed refId in the selection set', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.trackQueryRename('A', 'A_renamed'));
      expect(result.current.selectedQueryRefIds).toEqual(['A_renamed', 'B']);
    });
  });
});
