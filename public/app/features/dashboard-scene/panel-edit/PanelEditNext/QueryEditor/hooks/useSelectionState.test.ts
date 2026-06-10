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

    it('does NOT call onClearSideEffects (only active changes do)', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      expect(onClearSideEffects).not.toHaveBeenCalled();
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

    it('keeps the last selection when Cmd+clicking the only selected query', () => {
      // Once a single item is in the bulk set, Cmd+clicking it should keep it so we never
      // reach a "selection mode but nothing selected" state.
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }, { multi: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A']);

      act(() => result.current.toggleQuerySelection({ refId: 'A' }, { multi: true }));

      expect(result.current.selectedQueryRefIds).toEqual(['A']);
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
      // First query is the active default, so Shift+Click C range-selects A-C.
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

    it('uses the active query as implicit anchor after clearSelection', () => {
      const { result } = setup();
      act(() => result.current.clearSelection());
      // clearSelection clears bulk and resets active to the first query.
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.activeQueryRefId).toBe('A');

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

    it('does not range-select when shift-clicking a query while a transformation is active', () => {
      const { result } = setup();
      // Activate a transformation so it becomes the active card.
      act(() => result.current.activateTransformation(mockTransformations[0]));
      expect(result.current.activeTransformationId).toBe('tx-0');
      expect(result.current.activeQueryRefId).toBeNull();
      // Shift+Click a query — should NOT range-select across card types, just plain-select.
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['C']);
    });

    it('keeps the anchor pinned so a later Shift+Click shrinks the range (A, Shift+C, Shift+B → A,B)', () => {
      const { result } = setup();
      // Anchor on A, expand to C, then shrink back to B. The anchor must stay on A rather
      // than drifting to the last-clicked id, otherwise B-C would linger.
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C']);

      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);
    });

    it('re-derives the range from the pinned anchor when crossing sides', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'C' }));
      act(() => result.current.toggleQuerySelection({ refId: 'A' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C']);

      // Shift+Click past the anchor on the other side — range is still measured from C.
      act(() => result.current.toggleQuerySelection({ refId: 'D' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['C', 'D']);
    });

    it('preserves Ctrl-added selections outside the Shift range', () => {
      const { result } = setup();
      // Independently pick A, then Ctrl+pick C (anchor moves to C). Shift+Click D extends from
      // the new anchor C while the independent A survives.
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { multi: true }));
      act(() => result.current.toggleQuerySelection({ refId: 'D' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'C', 'D']);
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

    it('does NOT call onClearSideEffects (only active changes do)', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      expect(onClearSideEffects).not.toHaveBeenCalled();
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

    it('keeps the last selection when Cmd+clicking the only selected transformation', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      expect(result.current.selectedTransformationIds).toEqual(['tx-0']);

      act(() => result.current.toggleTransformationSelection(mockTransformations[0], { multi: true }));

      expect(result.current.selectedTransformationIds).toEqual(['tx-0']);
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

    it('keeps the anchor pinned so a later Shift+Click shrinks the range', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2], { range: true }));
      expect(result.current.selectedTransformationIds).toEqual(['tx-0', 'tx-1', 'tx-2']);

      act(() => result.current.toggleTransformationSelection(mockTransformations[1], { range: true }));
      expect(result.current.selectedTransformationIds).toEqual(['tx-0', 'tx-1']);
    });
  });

  describe('clearSelection', () => {
    it('clears bulk arrays and resets active to the first query', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { multi: true }));
      act(() => result.current.clearSelection());
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
      expect(result.current.activeQueryRefId).toBe('A');
      expect(result.current.activeTransformationId).toBeNull();
    });

    it('clears to empty when there are no queries to default to', () => {
      const { result } = setup({ ...defaultProps, queries: [] });
      act(() => result.current.clearSelection());
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
      expect(result.current.activeQueryRefId).toBeNull();
      expect(result.current.activeTransformationId).toBeNull();
    });

    it('calls onClearSideEffects', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      act(() => result.current.clearSelection());
      expect(onClearSideEffects).toHaveBeenCalled();
    });
  });

  describe('onCardSelectionChange', () => {
    it('sets active query and clears bulk arrays', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { multi: true }));
      act(() => result.current.toggleTransformationSelection(mockTransformations[0], { multi: true }));
      act(() => result.current.onCardSelectionChange('A', null));
      expect(result.current.activeQueryRefId).toBe('A');
      expect(result.current.activeTransformationId).toBeNull();
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('sets active transformation and clears bulk arrays', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { multi: true }));
      act(() => result.current.onCardSelectionChange(null, 'tx-0'));
      expect(result.current.activeQueryRefId).toBeNull();
      expect(result.current.activeTransformationId).toBe('tx-0');
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('clears active and bulk arrays when both args are null', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }, { multi: true }));
      act(() => result.current.onCardSelectionChange(null, null));
      expect(result.current.activeQueryRefId).toBeNull();
      expect(result.current.activeTransformationId).toBeNull();
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });
  });

  describe('activateQuery / activateTransformation', () => {
    it('activateQuery sets the active query without touching bulk arrays', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }, { multi: true }));
      act(() => result.current.toggleQuerySelection({ refId: 'B' }, { multi: true }));
      act(() => result.current.activateQuery({ refId: 'C' }));
      expect(result.current.activeQueryRefId).toBe('C');
      expect(result.current.activeTransformationId).toBeNull();
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B']);
    });

    it('activateTransformation sets the active transformation without touching bulk arrays', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0], { multi: true }));
      act(() => result.current.activateTransformation(mockTransformations[2]));
      expect(result.current.activeTransformationId).toBe('tx-2');
      expect(result.current.activeQueryRefId).toBeNull();
      expect(result.current.selectedTransformationIds).toEqual(['tx-0']);
    });

    it('activateQuery calls onClearSideEffects', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      onClearSideEffects.mockClear();
      act(() => result.current.activateQuery({ refId: 'B' }));
      expect(onClearSideEffects).toHaveBeenCalledTimes(1);
    });

    it('activateTransformation calls onClearSideEffects', () => {
      const onClearSideEffects = jest.fn();
      const { result } = setup({ ...defaultProps, onClearSideEffects });
      onClearSideEffects.mockClear();
      act(() => result.current.activateTransformation(mockTransformations[0]));
      expect(onClearSideEffects).toHaveBeenCalledTimes(1);
    });
  });

  describe('selectActiveInMultiSelection', () => {
    it('checks the active query', () => {
      const { result } = setup();
      act(() => result.current.activateQuery({ refId: 'B' }));
      act(() => result.current.selectActiveInMultiSelection());
      expect(result.current.selectedQueryRefIds).toEqual(['B']);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('checks the active transformation and clears query bulk selection', () => {
      const { result } = setup();
      act(() => result.current.activateTransformation(mockTransformations[1]));
      act(() => result.current.selectActiveInMultiSelection());
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual(['tx-1']);
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

  describe('onCardSelectionChange — seedBulk', () => {
    it('seeds the bulk selection with the activated query', () => {
      const { result } = setup();
      act(() => result.current.onCardSelectionChange('B', null, { seedBulk: true }));
      expect(result.current.activeQueryRefId).toBe('B');
      expect(result.current.selectedQueryRefIds).toEqual(['B']);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });

    it('seeds the bulk selection with the activated transformation', () => {
      const { result } = setup();
      act(() => result.current.onCardSelectionChange(null, 'tx-1', { seedBulk: true }));
      expect(result.current.activeTransformationId).toBe('tx-1');
      expect(result.current.selectedTransformationIds).toEqual(['tx-1']);
      expect(result.current.selectedQueryRefIds).toEqual([]);
    });

    it('seeds the query anchor so a follow-up Shift+Click ranges from it', () => {
      const { result } = setup();
      act(() => result.current.onCardSelectionChange('B', null, { seedBulk: true }));
      act(() => result.current.toggleQuerySelection({ refId: 'D' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['B', 'C', 'D']);
    });

    it('seeds nothing when activating with null ids', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.onCardSelectionChange(null, null, { seedBulk: true }));
      expect(result.current.selectedQueryRefIds).toEqual([]);
      expect(result.current.selectedTransformationIds).toEqual([]);
    });
  });

  describe('removeQueryFromSelection', () => {
    it('removes the query from the bulk selection', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      act(() => result.current.toggleQuerySelection({ refId: 'C' }, { multi: true }));
      act(() => result.current.removeQueryFromSelection('A'));
      expect(result.current.selectedQueryRefIds).toEqual(['C']);
    });

    it('falls the active query back to the first query when the active one is removed', () => {
      const { result } = setup();
      act(() => result.current.activateQuery(mockQueries[2]));
      expect(result.current.activeQueryRefId).toBe('C');
      act(() => result.current.removeQueryFromSelection('C'));
      expect(result.current.activeQueryRefId).toBe('A');
    });

    it('leaves the active query untouched when a different query is removed', () => {
      const { result } = setup();
      act(() => result.current.activateQuery(mockQueries[2]));
      act(() => result.current.removeQueryFromSelection('A'));
      expect(result.current.activeQueryRefId).toBe('C');
    });

    it('clears the anchor so a later Shift+Click no longer ranges from the removed query', () => {
      const { result } = setup();
      // Anchor on B via plain click, then remove B.
      act(() => result.current.toggleQuerySelection({ refId: 'B' }));
      act(() => result.current.removeQueryFromSelection('B'));
      // With the anchor cleared, a Shift+Click on D ranges from the active query (A), not B.
      act(() => result.current.toggleQuerySelection({ refId: 'D' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('removeTransformationFromSelection', () => {
    it('removes the transformation from the bulk selection', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2], { multi: true }));
      act(() => result.current.removeTransformationFromSelection('tx-0'));
      expect(result.current.selectedTransformationIds).toEqual(['tx-2']);
    });

    it('clears the active transformation when the active one is removed', () => {
      const { result } = setup();
      act(() => result.current.activateTransformation(mockTransformations[1]));
      expect(result.current.activeTransformationId).toBe('tx-1');
      act(() => result.current.removeTransformationFromSelection('tx-1'));
      expect(result.current.activeTransformationId).toBeNull();
    });

    it('clears the anchor so a later Shift+Click no longer ranges from the removed transformation', () => {
      const { result } = setup();
      act(() => result.current.toggleTransformationSelection(mockTransformations[0]));
      act(() => result.current.removeTransformationFromSelection('tx-0'));
      act(() => result.current.toggleTransformationSelection(mockTransformations[2], { range: true }));
      // Anchor cleared → plain selection of the clicked transformation only.
      expect(result.current.selectedTransformationIds).toEqual(['tx-2']);
    });
  });

  describe('reconciling the active transformation with the list', () => {
    it('clears the active transformation when it is removed from the transformations list', () => {
      const { result, rerender } = renderHook((props: UseSelectionStateOptions) => useSelectionState(props), {
        initialProps: defaultProps,
      });
      act(() => result.current.activateTransformation(mockTransformations[1]));
      expect(result.current.activeTransformationId).toBe('tx-1');
      rerender({ ...defaultProps, transformations: mockTransformations.filter((t) => t.transformId !== 'tx-1') });
      expect(result.current.activeTransformationId).toBeNull();
    });
  });

  describe('range selection with an unknown card', () => {
    it('falls back to a plain selection when the Shift+Clicked query is not in the list', () => {
      const { result } = setup();
      act(() => result.current.toggleQuerySelection({ refId: 'A' }));
      // 'Z' is not part of the queries, so the contiguous range cannot be computed.
      act(() => result.current.toggleQuerySelection({ refId: 'Z' }, { range: true }));
      expect(result.current.selectedQueryRefIds).toEqual(['Z']);
    });
  });
});
