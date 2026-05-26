import { useCallback, useEffect, useRef, useState } from 'react';

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
  activeQueryRefId: string | null;
  activeTransformationId: string | null;
  selectedQueryRefIds: string[];
  selectedTransformationIds: string[];
  onCardSelectionChange: (
    queryRefId: string | null,
    transformationId: string | null,
    options?: { seedBulk?: boolean }
  ) => void;
  trackQueryRename: (originalRefId: string, updatedRefId: string) => void;
  activateQuery: (query: DataQuery | ExpressionQuery) => void;
  activateTransformation: (transformation: Transformation) => void;
  toggleQuerySelection: (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => void;
  toggleTransformationSelection: (transformation: Transformation, modifiers?: SelectionModifiers) => void;
  clearSelection: () => void;
  clearMultiSelection: () => void;
  /** Seeds bulk selection from the active card when entering multi-select mode. */
  selectActiveInMultiSelection: () => void;
  removeQueryFromSelection: (refId: string) => void;
  removeTransformationFromSelection: (transformId: string) => void;
}

/**
 * Returns the new ordered selection after a Shift+Click (range-select) in multi-select.
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
 * Manages active (editor/highlight) and multi-select (bulk actions) state separately.
 *
 * - `activeQueryRefId` / `activeTransformationId`: active card for the editor pane.
 * - `selectedQueryRefIds` / `selectedTransformationIds`: bulk selection set (checkbox / modifiers).
 *
 * Query and transformation active selections are mutually exclusive, as are query vs
 * transformation multi-select sets.
 */
export function useSelectionState({
  queries,
  transformations,
  onClearSideEffects,
}: UseSelectionStateOptions): UseSelectionStateResult {
  const [activeQueryRefId, setActiveQueryRefId] = useState<string | null>(() => queries[0]?.refId ?? null);
  const [activeTransformationId, setActiveTransformationId] = useState<string | null>(null);
  const [selectedQueryRefIds, setSelectedQueryRefIds] = useState<string[]>([]);
  const [selectedTransformationIds, setSelectedTransformationIds] = useState<string[]>([]);

  const onClearSideEffectsRef = useRef(onClearSideEffects);
  onClearSideEffectsRef.current = onClearSideEffects;

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

  // Reconcile active ids when the underlying lists change (e.g. after a delete propagates
  // from the Scene). Without this, activeQueryRefId / activeTransformationId can reference
  // items that no longer exist, causing downstream consumers like selectActiveInMultiSelection
  // to seed stale ids into the bulk set.
  useEffect(() => {
    if (activeQueryRefId !== null && !queries.some((q) => q.refId === activeQueryRefId)) {
      setActiveQueryRefId(queries[0]?.refId ?? null);
    }
  }, [queries, activeQueryRefId]);

  useEffect(() => {
    if (activeTransformationId !== null && !transformations.some((t) => t.transformId === activeTransformationId)) {
      setActiveTransformationId(null);
    }
  }, [transformations, activeTransformationId]);

  const onCardSelectionChange = useCallback(
    (queryRefId: string | null, transformationId: string | null, options?: { seedBulk?: boolean }) => {
      setActiveQueryRefId(queryRefId);
      setActiveTransformationId(transformationId);
      if (options?.seedBulk) {
        setSelectedQueryRefIds(queryRefId ? [queryRefId] : []);
        setSelectedTransformationIds(transformationId ? [transformationId] : []);
      } else {
        setSelectedQueryRefIds([]);
        setSelectedTransformationIds([]);
      }
    },
    []
  );

  const trackQueryRename = useCallback((originalRefId: string, updatedRefId: string) => {
    setActiveQueryRefId((current) => (current === originalRefId ? updatedRefId : current));
    setSelectedQueryRefIds((current) => current.map((id) => (id === originalRefId ? updatedRefId : id)));
  }, []);

  const activateQuery = useCallback((query: DataQuery | ExpressionQuery) => {
    setActiveQueryRefId(query.refId);
    setActiveTransformationId(null);
    onClearSideEffectsRef.current?.();
  }, []);

  const activateTransformation = useCallback((transformation: Transformation) => {
    setActiveQueryRefId(null);
    setActiveTransformationId(transformation.transformId);
    onClearSideEffectsRef.current?.();
  }, []);

  const toggleQuerySelection = useCallback((query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
    setSelectedTransformationIds([]);

    const currentSelection = selectedQueryRefIdsRef.current;
    // When a transformation is active and there's no current query selection, fall through
    // to plain-click instead of range-selecting from queries[0] — avoids surprising ranges
    // that cross card types.
    const hasActiveTransformation = activeTransformationIdRef.current !== null;
    const anchorRefId =
      currentSelection.at(-1) ??
      activeQueryRefIdRef.current ??
      (hasActiveTransformation ? undefined : queriesRef.current[0]?.refId);

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

    if (modifiers?.multi) {
      setSelectedQueryRefIds((prev) => {
        const idx = prev.indexOf(query.refId);
        if (idx === -1) {
          return [...prev, query.refId];
        }
        return prev.length === 1 ? prev : prev.filter((id) => id !== query.refId);
      });
    } else {
      setSelectedQueryRefIds([query.refId]);
    }
  }, []);

  const toggleTransformationSelection = useCallback(
    (transformation: Transformation, modifiers?: SelectionModifiers) => {
      setSelectedQueryRefIds([]);

      const currentSelection = selectedTransformationIdsRef.current;
      if (modifiers?.range && currentSelection.length > 0) {
        const anchorId = currentSelection.at(-1)!;
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

      if (modifiers?.multi) {
        setSelectedTransformationIds((prev) => {
          const idx = prev.indexOf(transformation.transformId);
          if (idx === -1) {
            return [...prev, transformation.transformId];
          }
          return prev.length === 1 ? prev : prev.filter((id) => id !== transformation.transformId);
        });
      } else {
        setSelectedTransformationIds([transformation.transformId]);
      }
    },
    []
  );

  const clearMultiSelection = useCallback(() => {
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);
  }, []);

  const selectActiveInMultiSelection = useCallback(() => {
    const transformationId = activeTransformationIdRef.current;
    if (transformationId) {
      setSelectedQueryRefIds([]);
      setSelectedTransformationIds([transformationId]);
      return;
    }

    const queryRefId = activeQueryRefIdRef.current;
    if (queryRefId) {
      setSelectedTransformationIds([]);
      setSelectedQueryRefIds([queryRefId]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    const firstQueryRefId = queriesRef.current[0]?.refId ?? null;
    setActiveQueryRefId(firstQueryRefId);
    setActiveTransformationId(null);
    clearMultiSelection();
    onClearSideEffectsRef.current?.();
  }, [clearMultiSelection]);

  const removeQueryFromSelection = useCallback((refId: string) => {
    setSelectedQueryRefIds((current) => current.filter((id) => id !== refId));
    setActiveQueryRefId((current) => {
      if (current !== refId) {
        return current;
      }
      return queriesRef.current[0]?.refId ?? null;
    });
  }, []);

  const removeTransformationFromSelection = useCallback((transformId: string) => {
    setSelectedTransformationIds((current) => current.filter((id) => id !== transformId));
    setActiveTransformationId((current) => (current === transformId ? null : current));
  }, []);

  return {
    activeQueryRefId,
    activeTransformationId,
    selectedQueryRefIds,
    selectedTransformationIds,
    onCardSelectionChange,
    trackQueryRename,
    activateQuery,
    activateTransformation,
    toggleQuerySelection,
    toggleTransformationSelection,
    clearSelection,
    clearMultiSelection,
    selectActiveInMultiSelection,
    removeQueryFromSelection,
    removeTransformationFromSelection,
  };
}
