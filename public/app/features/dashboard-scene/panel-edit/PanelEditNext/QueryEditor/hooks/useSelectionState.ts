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
 * Returns the contiguous ids between `anchorId` and `clickedId` (inclusive), in list order.
 * Returns null when either id is not present in `orderedIds`.
 */
function getContiguousRange(orderedIds: string[], anchorId: string, clickedId: string): string[] | null {
  const anchorIdx = orderedIds.indexOf(anchorId);
  const clickedIdx = orderedIds.indexOf(clickedId);

  if (anchorIdx === -1 || clickedIdx === -1) {
    return null;
  }

  const start = Math.min(anchorIdx, clickedIdx);
  const end = Math.max(anchorIdx, clickedIdx);
  return orderedIds.slice(start, end + 1);
}

/**
 * Merges the stable "range base" (selections made before the current Shift sequence, e.g. via
 * Ctrl+Click) with the freshly computed contiguous range, preserving order and de-duplicating.
 */
function mergeRangeWithBase(base: string[], range: string[]): string[] {
  const baseSet = new Set(base);
  return [...base, ...range.filter((id) => !baseSet.has(id))];
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

  // Range-select anchors. The anchor is pinned by the last non-range action (plain or
  // Ctrl/Cmd toggle) and stays fixed across consecutive Shift+Clicks, so each Shift+Click
  // re-derives the range from the same origin (e.g. anchor 1: Shift+3 → 1-3, Shift+2 → 1-2).
  // The matching "range base" holds the selections that existed when the anchor was set so
  // independent Ctrl picks survive a later Shift-range.
  const queryAnchorRef = useRef<string | null>(null);
  const queryRangeBaseRef = useRef<string[]>([]);
  const transformationAnchorRef = useRef<string | null>(null);
  const transformationRangeBaseRef = useRef<string[]>([]);

  const resetSelectionAnchors = useCallback(() => {
    queryAnchorRef.current = null;
    queryRangeBaseRef.current = [];
    transformationAnchorRef.current = null;
    transformationRangeBaseRef.current = [];
  }, []);

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
      resetSelectionAnchors();
      if (options?.seedBulk) {
        setSelectedQueryRefIds(queryRefId ? [queryRefId] : []);
        setSelectedTransformationIds(transformationId ? [transformationId] : []);
        queryAnchorRef.current = queryRefId;
        transformationAnchorRef.current = transformationId;
      } else {
        setSelectedQueryRefIds([]);
        setSelectedTransformationIds([]);
      }
    },
    [resetSelectionAnchors]
  );

  const trackQueryRename = useCallback((originalRefId: string, updatedRefId: string) => {
    setActiveQueryRefId((current) => (current === originalRefId ? updatedRefId : current));
    setSelectedQueryRefIds((current) => current.map((id) => (id === originalRefId ? updatedRefId : id)));
    if (queryAnchorRef.current === originalRefId) {
      queryAnchorRef.current = updatedRefId;
    }
    queryRangeBaseRef.current = queryRangeBaseRef.current.map((id) => (id === originalRefId ? updatedRefId : id));
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
    transformationAnchorRef.current = null;
    transformationRangeBaseRef.current = [];

    const orderedIds = queriesRef.current.map(({ refId }) => refId);
    const currentSelection = selectedQueryRefIdsRef.current;

    if (modifiers?.range) {
      // When a transformation is active and there's no pinned query anchor, fall through to
      // plain-click instead of range-selecting from queries[0] — avoids surprising ranges
      // that cross card types.
      const hasActiveTransformation = activeTransformationIdRef.current !== null;
      const anchorRefId =
        queryAnchorRef.current ??
        activeQueryRefIdRef.current ??
        (hasActiveTransformation ? null : (orderedIds[0] ?? null));

      if (anchorRefId !== null) {
        const range = getContiguousRange(orderedIds, anchorRefId, query.refId);
        if (range) {
          // Anchor and base stay fixed so consecutive Shift+Clicks grow/shrink from the origin.
          setSelectedQueryRefIds(mergeRangeWithBase(queryRangeBaseRef.current, range));
          return;
        }
      }
      // No usable anchor — treat as a plain selection below.
    }

    if (modifiers?.multi) {
      const next = currentSelection.includes(query.refId)
        ? currentSelection.length === 1
          ? currentSelection
          : currentSelection.filter((id) => id !== query.refId)
        : [...currentSelection, query.refId];
      setSelectedQueryRefIds(next);
      // Pin the anchor to the toggled card; everything else becomes the base a later Shift extends.
      queryAnchorRef.current = query.refId;
      queryRangeBaseRef.current = next.filter((id) => id !== query.refId);
      return;
    }

    setSelectedQueryRefIds([query.refId]);
    queryAnchorRef.current = query.refId;
    queryRangeBaseRef.current = [];
  }, []);

  const toggleTransformationSelection = useCallback(
    (transformation: Transformation, modifiers?: SelectionModifiers) => {
      setSelectedQueryRefIds([]);
      queryAnchorRef.current = null;
      queryRangeBaseRef.current = [];

      const orderedIds = transformationsRef.current.map((t) => t.transformId);
      const currentSelection = selectedTransformationIdsRef.current;

      if (modifiers?.range) {
        const anchorId = transformationAnchorRef.current ?? activeTransformationIdRef.current;
        if (anchorId !== null) {
          const range = getContiguousRange(orderedIds, anchorId, transformation.transformId);
          if (range) {
            setSelectedTransformationIds(mergeRangeWithBase(transformationRangeBaseRef.current, range));
            return;
          }
        }
        // No usable anchor — treat as a plain selection below.
      }

      if (modifiers?.multi) {
        const next = currentSelection.includes(transformation.transformId)
          ? currentSelection.length === 1
            ? currentSelection
            : currentSelection.filter((id) => id !== transformation.transformId)
          : [...currentSelection, transformation.transformId];
        setSelectedTransformationIds(next);
        transformationAnchorRef.current = transformation.transformId;
        transformationRangeBaseRef.current = next.filter((id) => id !== transformation.transformId);
        return;
      }

      setSelectedTransformationIds([transformation.transformId]);
      transformationAnchorRef.current = transformation.transformId;
      transformationRangeBaseRef.current = [];
    },
    []
  );

  const clearMultiSelection = useCallback(() => {
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);
    resetSelectionAnchors();
  }, [resetSelectionAnchors]);

  const selectActiveInMultiSelection = useCallback(() => {
    resetSelectionAnchors();

    const transformationId = activeTransformationIdRef.current;
    if (transformationId) {
      setSelectedQueryRefIds([]);
      setSelectedTransformationIds([transformationId]);
      transformationAnchorRef.current = transformationId;
      return;
    }

    const queryRefId = activeQueryRefIdRef.current;
    if (queryRefId) {
      setSelectedTransformationIds([]);
      setSelectedQueryRefIds([queryRefId]);
      queryAnchorRef.current = queryRefId;
    }
  }, [resetSelectionAnchors]);

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
    if (queryAnchorRef.current === refId) {
      queryAnchorRef.current = null;
    }
    queryRangeBaseRef.current = queryRangeBaseRef.current.filter((id) => id !== refId);
  }, []);

  const removeTransformationFromSelection = useCallback((transformId: string) => {
    setSelectedTransformationIds((current) => current.filter((id) => id !== transformId));
    setActiveTransformationId((current) => (current === transformId ? null : current));
    if (transformationAnchorRef.current === transformId) {
      transformationAnchorRef.current = null;
    }
    transformationRangeBaseRef.current = transformationRangeBaseRef.current.filter((id) => id !== transformId);
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
