import { useCallback, useRef, useState } from 'react';

import { DataQuery } from '@grafana/schema';
import { ExpressionQuery } from 'app/features/expressions/types';

import { SelectionModifiers } from '../QueryEditorContext';
import { Transformation } from '../types';

export interface UseMultiSelectionOptions {
  queries: DataQuery[];
  transformations: Transformation[];
  /**
   * Injected callback to break the circular dependency:
   *   useMultiSelection → onClearSideEffects → clearSideEffects → clearPendingExpression
   *   → usePendingExpression → onCardSelectionChange → useMultiSelection
   *
   * Called on plain (non-multi, non-range) clicks and clearSelection to reset UI
   * side-effects such as open pickers, datasource help, and transform toggles.
   */
  onClearSideEffects?: () => void;
}

export interface UseMultiSelectionResult {
  selectedQueryRefIds: string[];
  selectedTransformationIds: string[];
  selectedAlertId: string | null;
  onCardSelectionChange: (queryRefId: string | null, transformationId: string | null) => void;
  /** Selects an alert and clears query/transformation selection (for cross-type exclusivity). */
  selectAlert: (alertId: string | null) => void;
  /** Updates selection to track a refId rename so the editor stays open on the renamed query. */
  trackQueryRename: (originalRefId: string, updatedRefId: string) => void;
  toggleQuerySelection: (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => void;
  toggleTransformationSelection: (transformation: Transformation, modifiers?: SelectionModifiers) => void;
  clearSelection: () => void;
}

/**
 * Returns the new ordered selection after a Shift+Click (range-select).
 *
 * Unions the existing selection with the range between anchor and clicked item.
 * The clicked item becomes the last element (primary). Returns `null` if either
 * the anchor or the clicked ID cannot be found in the list.
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
  // Ordered arrays — last element is the "primary" selection (shown in editor pane).
  const [selectedQueryRefIds, setSelectedQueryRefIds] = useState<string[]>([]);
  const [selectedTransformationIds, setSelectedTransformationIds] = useState<string[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Store in a ref so toggle callbacks stay stable without listing onClearSideEffects as a dep.
  const onClearSideEffectsRef = useRef(onClearSideEffects);
  onClearSideEffectsRef.current = onClearSideEffects;

  /**
   * Used by usePendingExpression / usePendingTransformation to programmatically
   * select a card after adding it (e.g. after finalizing an expression type picker).
   */
  const onCardSelectionChange = useCallback((queryRefId: string | null, transformationId: string | null) => {
    setSelectedQueryRefIds(queryRefId ? [queryRefId] : []);
    setSelectedTransformationIds(transformationId ? [transformationId] : []);
    setSelectedAlertId(null);
  }, []);

  const selectAlert = useCallback((alertId: string | null) => {
    setSelectedAlertId(alertId);
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);
  }, []);

  const trackQueryRename = useCallback((originalRefId: string, updatedRefId: string) => {
    setSelectedQueryRefIds((current) => current.map((id) => (id === originalRefId ? updatedRefId : id)));
  }, []);

  const toggleQuerySelection = useCallback(
    (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
      // Query selection always clears transformations and alerts (cross-type exclusivity).
      setSelectedTransformationIds([]);
      setSelectedAlertId(null);

      if (modifiers?.range) {
        // Shift+Click: range-select from the anchor to this query (inclusive).
        // When nothing has been explicitly clicked yet, anchor defaults to queries[0]
        // so Shift+Click works immediately on page load.
        const anchorRefId = selectedQueryRefIds.at(-1) ?? queries[0]?.refId ?? null;
        if (anchorRefId) {
          const rangeSelection = computeRangeSelection(
            queries.map((q) => q.refId),
            selectedQueryRefIds,
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
    [queries, selectedQueryRefIds]
  );

  const toggleTransformationSelection = useCallback(
    (transformation: Transformation, modifiers?: SelectionModifiers) => {
      // Transformation selection always clears queries and alerts (cross-type exclusivity).
      setSelectedQueryRefIds([]);
      setSelectedAlertId(null);

      if (modifiers?.range && selectedTransformationIds.length > 0) {
        // Shift+Click: range-select from the last selected transformation to this one.
        const anchorId = selectedTransformationIds.at(-1)!;
        const rangeSelection = computeRangeSelection(
          transformations.map((t) => t.transformId),
          selectedTransformationIds,
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
    [transformations, selectedTransformationIds]
  );

  const clearSelection = useCallback(() => {
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);
    setSelectedAlertId(null);
    onClearSideEffectsRef.current?.();
  }, []);

  return {
    selectedQueryRefIds,
    selectedTransformationIds,
    selectedAlertId,
    onCardSelectionChange,
    selectAlert,
    trackQueryRename,
    toggleQuerySelection,
    toggleTransformationSelection,
    clearSelection,
  };
}
