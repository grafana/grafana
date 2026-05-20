import { useCallback, useRef, useState } from 'react';

import { type DataQuery } from '@grafana/schema';
import { type ExpressionQuery } from 'app/features/expressions/types';

import { type SelectionModifiers } from '../QueryEditorContext';
import { type Transformation } from '../types';

export interface UseSelectionStateOptions {
  queries: DataQuery[];
  transformations: Transformation[];
}

export interface UseSelectionStateResult {
  activeQueryRefId: string | null;
  activeTransformationId: string | null;
  selectedQueryRefIds: string[];
  selectedTransformationIds: string[];
  onCardSelectionChange: (queryRefId: string | null, transformationId: string | null) => void;
  trackQueryRename: (originalRefId: string, updatedRefId: string) => void;
  toggleQuerySelection: (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => void;
  toggleTransformationSelection: (transformation: Transformation, modifiers?: SelectionModifiers) => void;
  clearSelection: () => void;
  setSelectionFromActiveCard: () => void;
  removeQueryFromSelection: (refId: string) => void;
  removeTransformationFromSelection: (transformId: string) => void;
}

/**
 * Returns the new ordered bulk selection after a checkbox Shift+Click.
 *
 * Unions the existing selection with the range between anchor and clicked item.
 * The range is always returned in DOM order. Returns `null` if either the
 * anchor or the clicked ID cannot be found in the list.
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
 * Manages active editor selection and ordered bulk selection for queries and
 * transformations.
 *
 * Bulk selection supports two checkbox modes:
 * - Plain click: toggle this card in/out of the bulk selection
 * - Shift click (`range: true`): range-select from the last checked card to this card
 *
 * Query and transformation bulk selections are mutually exclusive. Active
 * editor selection is independent from bulk selection.
 */
export function useSelectionState({
  queries,
  transformations,
}: UseSelectionStateOptions): UseSelectionStateResult {
  const [activeQueryRefId, setActiveQueryRefId] = useState<string | null>(() => queries[0]?.refId ?? null);
  const [activeTransformationId, setActiveTransformationId] = useState<string | null>(null);
  const [selectedQueryRefIds, setSelectedQueryRefIds] = useState<string[]>([]);
  const [selectedTransformationIds, setSelectedTransformationIds] = useState<string[]>([]);

  const queriesRef = useRef(queries);
  queriesRef.current = queries;

  const transformationsRef = useRef(transformations);
  transformationsRef.current = transformations;

  const activeQueryRefIdRef = useRef(activeQueryRefId);
  activeQueryRefIdRef.current = activeQueryRefId;

  const activeTransformationIdRef = useRef(activeTransformationId);
  activeTransformationIdRef.current = activeTransformationId;

  const selectedQueryRefIdsRef = useRef(selectedQueryRefIds);
  selectedQueryRefIdsRef.current = selectedQueryRefIds;

  const selectedTransformationIdsRef = useRef(selectedTransformationIds);
  selectedTransformationIdsRef.current = selectedTransformationIds;

  /**
   * Used by usePendingExpression / usePendingTransformation to programmatically
   * select a card after adding it (e.g. after finalizing an expression type picker).
   */
  const onCardSelectionChange = useCallback((queryRefId: string | null, transformationId: string | null) => {
    setActiveQueryRefId(queryRefId);
    setActiveTransformationId(transformationId);
  }, []);

  const trackQueryRename = useCallback((originalRefId: string, updatedRefId: string) => {
    setActiveQueryRefId((current) => (current === originalRefId ? updatedRefId : current));
    setSelectedQueryRefIds((current) => current.map((id) => (id === originalRefId ? updatedRefId : id)));
  }, []);

  const toggleQuerySelection = useCallback((query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
    // Query bulk selection always clears transformations (cross-type exclusivity).
    setSelectedTransformationIds([]);

    const currentSelection = selectedQueryRefIdsRef.current;
    const anchorRefId = currentSelection.at(-1) ?? activeQueryRefIdRef.current ?? queriesRef.current[0]?.refId;
    if (modifiers?.range && anchorRefId) {
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
      // Transformation bulk selection always clears queries (cross-type exclusivity).
      setSelectedQueryRefIds([]);

      const currentSelection = selectedTransformationIdsRef.current;
      const anchorId = currentSelection.at(-1) ?? activeTransformationIdRef.current;
      if (modifiers?.range && anchorId) {
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

  const clearSelection = useCallback(() => {
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);
  }, []);

  const setSelectionFromActiveCard = useCallback(() => {
    const activeTransformationId = activeTransformationIdRef.current;
    if (activeTransformationId) {
      setSelectedQueryRefIds([]);
      setSelectedTransformationIds([activeTransformationId]);
      return;
    }

    const activeQueryRefId = activeQueryRefIdRef.current ?? queriesRef.current[0]?.refId;
    setSelectedQueryRefIds(activeQueryRefId ? [activeQueryRefId] : []);
    setSelectedTransformationIds([]);
  }, []);

  const removeQueryFromSelection = useCallback((refId: string) => {
    setSelectedQueryRefIds((current) => current.filter((id) => id !== refId));
  }, []);

  const removeTransformationFromSelection = useCallback((transformId: string) => {
    setSelectedTransformationIds((current) => current.filter((id) => id !== transformId));
  }, []);

  return {
    activeQueryRefId,
    activeTransformationId,
    selectedQueryRefIds,
    selectedTransformationIds,
    onCardSelectionChange,
    trackQueryRename,
    toggleQuerySelection,
    toggleTransformationSelection,
    clearSelection,
    setSelectionFromActiveCard,
    removeQueryFromSelection,
    removeTransformationFromSelection,
  };
}
