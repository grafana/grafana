import { useCallback, useRef, useState } from 'react';

import { type DataQuery } from '@grafana/schema';
import { type ExpressionQuery } from 'app/features/expressions/types';

import { type SelectionModifiers } from '../QueryEditorContext';
import { type Transformation } from '../types';

export interface UseSelectionStateOptions {
  queries: DataQuery[];
  transformations: Transformation[];
  onClearSideEffects?: () => void;
}

export interface UseSelectionStateResult {
  // Single card per type that drives the editor pane and the border highlight.
  highlightedQueryRefId: string | null;
  highlightedTransformationId: string | null;
  // Checkbox set per type. Only non-empty inside multi-select mode.
  selectedQueryRefIds: string[];
  selectedTransformationIds: string[];
  // Card body click: move the highlight to this card. Cross-type clears the
  // other type's highlight and selection set; same-type leaves the selection
  // set untouched.
  highlightQuery: (query: DataQuery | ExpressionQuery) => void;
  highlightTransformation: (transformation: Transformation) => void;
  // Checkbox click: toggle this card in/out of the selection set. Does not
  // change the highlight. `range` extends from the last toggled id.
  toggleQuerySelection: (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => void;
  toggleTransformationSelection: (transformation: Transformation, modifiers?: SelectionModifiers) => void;
  // Programmatic highlight setter (e.g. after adding a query from a picker).
  // Resets both selection sets so the editor pane is in single-card mode.
  onCardSelectionChange: (queryRefId: string | null, transformationId: string | null) => void;
  // Bulk-actions "X" button: empty both selection sets. The highlight stays
  // unless it points to a stale id (e.g. after a bulk delete), in which case
  // it falls back to queries[0].
  clearSelection: () => void;
  // Called when entering multi-select mode. Seeds the selection set of the
  // currently highlighted type so the bar opens with one item selected.
  seedSelectionWithHighlight: () => void;
  trackQueryRename: (originalRefId: string, updatedRefId: string) => void;
  removeQueryFromSelection: (refId: string) => void;
  removeTransformationFromSelection: (transformId: string) => void;
}

/**
 * Returns the new ordered selection after a Shift+Click (range-select).
 *
 * Unions the existing selection with the range between anchor and clicked item.
 * The range is always returned in DOM order, so the item with the higher index
 * becomes the last element. Returns `null` if either the anchor or the clicked
 * ID cannot be found in the list.
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

  const start = Math.min(anchorIdx, clickedIdx);
  const end = Math.max(anchorIdx, clickedIdx);
  const rangeIds = orderedIds.slice(start, end + 1);

  const rangeSet = new Set(rangeIds);
  const existingWithoutRange = existingSelection.filter((id) => !rangeSet.has(id));
  return [...existingWithoutRange, ...rangeIds];
}

/**
 * Manages the highlight + selection-set state for queries and transformations.
 *
 * Two pieces of state per type, deliberately independent:
 * - `highlighted*Id` — single id, drives the editor pane and the card border.
 *   Mutated by card-body clicks (`highlightQuery` / `highlightTransformation`).
 * - `selected*Ids` — checkbox set, drives bulk actions. Only non-empty inside
 *   multi-select mode. Mutated by checkbox clicks (`toggleQuerySelection` /
 *   `toggleTransformationSelection`, with optional `{ range }` modifier).
 *
 * Query and transformation are mutually exclusive: switching highlight type
 * also clears the other type's selection set so the editor pane never shows
 * a mismatched card.
 */
export function useSelectionState({
  queries,
  transformations,
  onClearSideEffects,
}: UseSelectionStateOptions): UseSelectionStateResult {
  // Eagerly highlight the first query when available at mount time so the
  // sidebar shows it without waiting for a user click.
  const [highlightedQueryRefId, setHighlightedQueryRefId] = useState<string | null>(() => queries[0]?.refId ?? null);
  const [highlightedTransformationId, setHighlightedTransformationId] = useState<string | null>(null);
  const [selectedQueryRefIds, setSelectedQueryRefIds] = useState<string[]>([]);
  const [selectedTransformationIds, setSelectedTransformationIds] = useState<string[]>([]);

  // Store in refs so callbacks stay stable without listing these as deps.
  // This prevents callback recreation on every selection change, avoiding
  // re-render cascades.
  const onClearSideEffectsRef = useRef(onClearSideEffects);
  onClearSideEffectsRef.current = onClearSideEffects;

  const queriesRef = useRef(queries);
  queriesRef.current = queries;

  const transformationsRef = useRef(transformations);
  transformationsRef.current = transformations;

  const highlightedQueryRefIdRef = useRef(highlightedQueryRefId);
  highlightedQueryRefIdRef.current = highlightedQueryRefId;

  const highlightedTransformationIdRef = useRef(highlightedTransformationId);
  highlightedTransformationIdRef.current = highlightedTransformationId;

  const selectedQueryRefIdsRef = useRef(selectedQueryRefIds);
  selectedQueryRefIdsRef.current = selectedQueryRefIds;

  const selectedTransformationIdsRef = useRef(selectedTransformationIds);
  selectedTransformationIdsRef.current = selectedTransformationIds;

  /**
   * Programmatic full-reset used by usePendingExpression / usePendingTransformation
   * to highlight a card after adding it (e.g. after finalizing an expression
   * type picker). Empties the checkbox selection so the editor pane is in
   * single-card mode.
   */
  const onCardSelectionChange = useCallback((queryRefId: string | null, transformationId: string | null) => {
    setHighlightedQueryRefId(queryRefId);
    setHighlightedTransformationId(transformationId);
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);
  }, []);

  const trackQueryRename = useCallback((originalRefId: string, updatedRefId: string) => {
    setHighlightedQueryRefId((current) => (current === originalRefId ? updatedRefId : current));
    setSelectedQueryRefIds((current) => current.map((id) => (id === originalRefId ? updatedRefId : id)));
  }, []);

  const highlightQuery = useCallback((query: DataQuery | ExpressionQuery) => {
    setHighlightedQueryRefId(query.refId);
    // Cross-type exclusivity: switching highlight to a query clears any
    // transformation highlight + selection so the editor pane never shows
    // a mismatched card.
    setHighlightedTransformationId(null);
    setSelectedTransformationIds([]);
    onClearSideEffectsRef.current?.();
  }, []);

  const highlightTransformation = useCallback((transformation: Transformation) => {
    setHighlightedTransformationId(transformation.transformId);
    setHighlightedQueryRefId(null);
    setSelectedQueryRefIds([]);
    onClearSideEffectsRef.current?.();
  }, []);

  const toggleQuerySelection = useCallback((query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
    const currentSelection = selectedQueryRefIdsRef.current;

    if (modifiers?.range) {
      // Shift+click on a checkbox range-selects from the last toggled id (or
      // the highlight as a fallback) to this one.
      const anchorRefId = currentSelection.at(-1) ?? highlightedQueryRefIdRef.current ?? undefined;
      if (anchorRefId) {
        const rangeSelection = computeRangeSelection(
          queriesRef.current.map(({ refId }) => refId),
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

    setSelectedQueryRefIds((prev) => {
      const idx = prev.indexOf(query.refId);
      if (idx === -1) {
        return [...prev, query.refId];
      }
      return prev.filter((id) => id !== query.refId);
    });
  }, []);

  const toggleTransformationSelection = useCallback(
    (transformation: Transformation, modifiers?: SelectionModifiers) => {
      const currentSelection = selectedTransformationIdsRef.current;

      if (modifiers?.range) {
        const anchorId = currentSelection.at(-1) ?? highlightedTransformationIdRef.current ?? undefined;
        if (anchorId) {
          const rangeSelection = computeRangeSelection(
            transformationsRef.current.map((t) => t.transformId),
            currentSelection,
            anchorId,
            transformation.transformId
          );
          if (rangeSelection) {
            setSelectedTransformationIds(rangeSelection);
            return;
          }
        }
      }

      setSelectedTransformationIds((prev) => {
        const idx = prev.indexOf(transformation.transformId);
        if (idx === -1) {
          return [...prev, transformation.transformId];
        }
        return prev.filter((id) => id !== transformation.transformId);
      });
    },
    []
  );

  /**
   * Called by the wrapper when entering multi-select mode via the "Select..."
   * button. Pre-checks the currently highlighted card so the bar opens with
   * one item selected (instead of an empty / degenerate state).
   */
  const seedSelectionWithHighlight = useCallback(() => {
    if (highlightedQueryRefIdRef.current) {
      setSelectedQueryRefIds([highlightedQueryRefIdRef.current]);
      return;
    }
    if (highlightedTransformationIdRef.current) {
      setSelectedTransformationIds([highlightedTransformationIdRef.current]);
    }
  }, []);

  /**
   * Bulk-actions "X" button. Empties both selection sets. The highlight stays
   * unless it points to a stale id (e.g. after bulk delete removes the
   * highlighted card), in which case we fall back to queries[0] / null.
   */
  const clearSelection = useCallback(() => {
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);

    const queriesNow = queriesRef.current;
    setHighlightedQueryRefId((current) => {
      if (current && queriesNow.some((q) => q.refId === current)) {
        return current;
      }
      // Highlighted query no longer exists (likely bulk-deleted). If a
      // transformation is highlighted, leave the query highlight cleared so we
      // don't fight cross-type exclusivity.
      if (highlightedTransformationIdRef.current) {
        return null;
      }
      return queriesNow[0]?.refId ?? null;
    });
    setHighlightedTransformationId((current) => {
      if (current && transformationsRef.current.some((t) => t.transformId === current)) {
        return current;
      }
      return null;
    });

    onClearSideEffectsRef.current?.();
  }, []);

  const removeQueryFromSelection = useCallback((refId: string) => {
    setSelectedQueryRefIds((current) => current.filter((id) => id !== refId));
    setHighlightedQueryRefId((current) => (current === refId ? null : current));
  }, []);

  const removeTransformationFromSelection = useCallback((transformId: string) => {
    setSelectedTransformationIds((current) => current.filter((id) => id !== transformId));
    setHighlightedTransformationId((current) => (current === transformId ? null : current));
  }, []);

  return {
    highlightedQueryRefId,
    highlightedTransformationId,
    selectedQueryRefIds,
    selectedTransformationIds,
    highlightQuery,
    highlightTransformation,
    toggleQuerySelection,
    toggleTransformationSelection,
    onCardSelectionChange,
    clearSelection,
    seedSelectionWithHighlight,
    trackQueryRename,
    removeQueryFromSelection,
    removeTransformationFromSelection,
  };
}
