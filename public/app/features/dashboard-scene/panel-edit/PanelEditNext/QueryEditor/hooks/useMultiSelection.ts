import { useCallback, useRef, useState } from 'react';

import { type DataQuery } from '@grafana/schema';
import { type ExpressionQuery } from 'app/features/expressions/types';

import { type SelectionModifiers } from '../QueryEditorContext';
import { type Transformation } from '../types';

export interface UseMultiSelectionOptions {
  queries: DataQuery[];
  transformations: Transformation[];
  onClearSideEffects?: () => void;
}

export interface UseMultiSelectionResult {
  selectedQueryRefIds: string[];
  selectedTransformationIds: string[];
  onCardSelectionChange: (queryRefId: string | null, transformationId: string | null) => void;
  /** Updates selection to track a refId rename so the editor stays open on the renamed query. */
  trackQueryRename: (originalRefId: string, updatedRefId: string) => void;
  toggleQuerySelection: (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => void;
  toggleTransformationSelection: (transformation: Transformation, modifiers?: SelectionModifiers) => void;
  clearSelection: () => void;
  /** Removes a query from selection (e.g. when deleted). */
  removeQueryFromSelection: (refId: string) => void;
  /** Removes a transformation from selection (e.g. when deleted). */
  removeTransformationFromSelection: (transformId: string) => void;
}

/**
 * Returns the new ordered selection after a Shift+Click (range-select).
 *
 * Unions the existing selection with the range between anchor and clicked item.
 * The range is always returned in DOM order, so the item with the higher index
 * becomes the last element (primary). Returns `null` if either the anchor or
 * the clicked ID cannot be found in the list.
 */
function computeRangeSelection(
  orderedIds: string[],
  existingSelection: string[],
  anchorId: string,
  clickedId: string
): string[] | null {
  const anchorIdx = orderedIds.indexOf(anchorId);
  const clickedIdx = orderedIds.indexOf(clickedId);
  if (anchorIdx === -1 || clickedIdx === -1) {
    return null;
  }
  const [start, end] = anchorIdx <= clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx];
  const rangeIds = orderedIds.slice(start, end + 1);
  // Union: keep any existing selections outside the range, then append the full range.
  // This preserves manually-added items while the range becomes the contiguous tail.
  const existingWithoutRange = existingSelection.filter((id) => !rangeIds.includes(id));
  return [...existingWithoutRange, ...rangeIds];
}

/**
 * Manages the ordered multi-selection state for queries and transformations.
 * The last element of each array is the "primary" item shown in the editor pane.
 *
 * Supports three click modes:
 * - Plain click: replace entire selection with just this card
 * - Ctrl/Cmd click (`multi: true`): toggle this card in/out of the current selection
 * - Shift click (`range: true`): range-select from the last anchor to this card
 *
 * Query and transformation selections are mutually exclusive — selecting one type
 * clears the other.
 */
export function useMultiSelection({
  queries,
  transformations,
  onClearSideEffects,
}: UseMultiSelectionOptions): UseMultiSelectionResult {
  const [selectedQueryRefIds, setSelectedQueryRefIds] = useState<string[]>([]);
  const [selectedTransformationIds, setSelectedTransformationIds] = useState<string[]>([]);

  // Store in refs so toggle callbacks stay stable without listing these as deps.
  // This prevents callback recreation on every selection change, avoiding re-render cascades.
  const onClearSideEffectsRef = useRef(onClearSideEffects);
  onClearSideEffectsRef.current = onClearSideEffects;

  const selectedQueryRefIdsRef = useRef(selectedQueryRefIds);
  selectedQueryRefIdsRef.current = selectedQueryRefIds;

  const selectedTransformationIdsRef = useRef(selectedTransformationIds);
  selectedTransformationIdsRef.current = selectedTransformationIds;

  /**
   * Used by usePendingExpression / usePendingTransformation to programmatically
   * select a card after adding it (e.g. after finalizing an expression type picker).
   */
  const onCardSelectionChange = useCallback((queryRefId: string | null, transformationId: string | null) => {
    setSelectedQueryRefIds(queryRefId ? [queryRefId] : []);
    setSelectedTransformationIds(transformationId ? [transformationId] : []);
  }, []);

  const trackQueryRename = useCallback((originalRefId: string, updatedRefId: string) => {
    setSelectedQueryRefIds((current) => current.map((id) => (id === originalRefId ? updatedRefId : id)));
  }, []);

  const toggleQuerySelection = useCallback(
    (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
      // Query selection always clears transformations (cross-type exclusivity).
      setSelectedTransformationIds([]);

      if (modifiers?.range) {
        // Shift+Click: range-select from the anchor to this query (inclusive).
        // When nothing has been explicitly clicked yet, anchor defaults to queries[0]
        // so Shift+Click works immediately on page load.
        const currentSelection = selectedQueryRefIdsRef.current;
        const anchorRefId = currentSelection.at(-1) ?? queries[0]?.refId ?? null;
        if (anchorRefId) {
          const rangeSelection = computeRangeSelection(
            queries.map((q) => q.refId),
            currentSelection,
            anchorRefId,
            query.refId
          );
          if (rangeSelection) {
            setSelectedQueryRefIds(rangeSelection);
            return;
          }
        }
      }

      if (modifiers?.multi) {
        // Ctrl/Cmd+Click: toggle this query in/out of the selection.
        setSelectedQueryRefIds((prev) => {
          const idx = prev.indexOf(query.refId);
          return idx === -1 ? [...prev, query.refId] : prev.filter((id) => id !== query.refId);
        });
      } else {
        // Plain click: replace entire selection with just this card.
        setSelectedQueryRefIds([query.refId]);
        onClearSideEffectsRef.current?.();
      }
    },
    [queries]
  );

  const toggleTransformationSelection = useCallback(
    (transformation: Transformation, modifiers?: SelectionModifiers) => {
      // Transformation selection always clears queries (cross-type exclusivity).
      setSelectedQueryRefIds([]);

      const currentSelection = selectedTransformationIdsRef.current;
      if (modifiers?.range && currentSelection.length > 0) {
        // Shift+Click: range-select from the last selected transformation to this one.
        const anchorId = currentSelection.at(-1)!;
        const rangeSelection = computeRangeSelection(
          transformations.map((t) => t.transformId),
          currentSelection,
          anchorId,
          transformation.transformId
        );
        if (rangeSelection) {
          setSelectedTransformationIds(rangeSelection);
          return;
        }
      }

      if (modifiers?.multi) {
        setSelectedTransformationIds((prev) => {
          const idx = prev.indexOf(transformation.transformId);
          return idx === -1
            ? [...prev, transformation.transformId]
            : prev.filter((id) => id !== transformation.transformId);
        });
      } else {
        setSelectedTransformationIds([transformation.transformId]);
        onClearSideEffectsRef.current?.();
      }
    },
    [transformations]
  );

  const clearSelection = useCallback(() => {
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);
    onClearSideEffectsRef.current?.();
  }, []);

  const removeQueryFromSelection = useCallback((refId: string) => {
    setSelectedQueryRefIds((current) => current.filter((id) => id !== refId));
  }, []);

  const removeTransformationFromSelection = useCallback((transformId: string) => {
    setSelectedTransformationIds((current) => current.filter((id) => id !== transformId));
  }, []);

  return {
    selectedQueryRefIds,
    selectedTransformationIds,
    onCardSelectionChange,
    trackQueryRename,
    toggleQuerySelection,
    toggleTransformationSelection,
    clearSelection,
    removeQueryFromSelection,
    removeTransformationFromSelection,
  };
}
