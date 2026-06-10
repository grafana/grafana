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

/** Ids between anchor and clicked (inclusive, list order), or null if either id is missing. */
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

/** Merges the "range base" (selections predating the current Shift sequence) with the new range. */
function mergeRangeWithBase(base: string[], range: string[]): string[] {
  const baseSet = new Set(base);
  return [...base, ...range.filter((id) => !baseSet.has(id))];
}

/**
 * Manages the active card and the multi-select (bulk) sets; queries and transformations are
 * mutually exclusive in both. The exposed active ids are resolved against the live lists each
 * render (stale transformation → null, stale/unset query → queries[0]), so every consumer
 * agrees on which card is active.
 */
export function useSelectionState({
  queries,
  transformations,
  onClearSideEffects,
}: UseSelectionStateOptions): UseSelectionStateResult {
  // Last explicit activation. Can go stale while Scene mutations propagate, so never
  // exposed — consumers read the resolved ids derived below.
  const [rawActiveQueryRefId, setRawActiveQueryRefId] = useState<string | null>(null);
  const [rawActiveTransformationId, setRawActiveTransformationId] = useState<string | null>(null);
  const [selectedQueryRefIds, setSelectedQueryRefIds] = useState<string[]>([]);
  const [selectedTransformationIds, setSelectedTransformationIds] = useState<string[]>([]);

  // Resolved active ids — valid by construction: stale transformation → null, stale/unset
  // query → queries[0].
  const activeTransformationId =
    rawActiveTransformationId !== null &&
    transformations.some(({ transformId }) => transformId === rawActiveTransformationId)
      ? rawActiveTransformationId
      : null;

  const rawQueryExists = rawActiveQueryRefId !== null && queries.some(({ refId }) => refId === rawActiveQueryRefId);
  const activeQueryRefId =
    activeTransformationId !== null ? null : rawQueryExists ? rawActiveQueryRefId : (queries[0]?.refId ?? null);

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

  // Shift-range anchors: pinned by the last non-range action, fixed across consecutive
  // Shift+Clicks. The "range base" keeps prior Ctrl picks alive outside a later range.
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

  // GC stale raw ids after deletes. Resolution already covers display; this only stops a
  // recycled id (deleting "A" frees "A" for the next added query) from re-attaching.
  useEffect(() => {
    if (rawActiveQueryRefId !== null && !queries.some(({ refId }) => refId === rawActiveQueryRefId)) {
      setRawActiveQueryRefId(null);
    }
  }, [queries, rawActiveQueryRefId]);

  useEffect(() => {
    if (
      rawActiveTransformationId !== null &&
      !transformations.some(({ transformId }) => transformId === rawActiveTransformationId)
    ) {
      setRawActiveTransformationId(null);
    }
  }, [transformations, rawActiveTransformationId]);

  const onCardSelectionChange = useCallback(
    (queryRefId: string | null, transformationId: string | null, options?: { seedBulk?: boolean }) => {
      setRawActiveQueryRefId(queryRefId);
      setRawActiveTransformationId(transformationId);
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
    setRawActiveQueryRefId((current) => (current === originalRefId ? updatedRefId : current));
    setSelectedQueryRefIds((current) => current.map((id) => (id === originalRefId ? updatedRefId : id)));
    if (queryAnchorRef.current === originalRefId) {
      queryAnchorRef.current = updatedRefId;
    }
    queryRangeBaseRef.current = queryRangeBaseRef.current.map((id) => (id === originalRefId ? updatedRefId : id));
  }, []);

  const activateQuery = useCallback((query: DataQuery | ExpressionQuery) => {
    setRawActiveQueryRefId(query.refId);
    setRawActiveTransformationId(null);
    onClearSideEffectsRef.current?.();
  }, []);

  const activateTransformation = useCallback((transformation: Transformation) => {
    setRawActiveQueryRefId(null);
    setRawActiveTransformationId(transformation.transformId);
    onClearSideEffectsRef.current?.();
  }, []);

  const toggleQuerySelection = useCallback((query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
    setSelectedTransformationIds([]);
    transformationAnchorRef.current = null;
    transformationRangeBaseRef.current = [];

    const orderedIds = queriesRef.current.map(({ refId }) => refId);
    const currentSelection = selectedQueryRefIdsRef.current;

    if (modifiers?.range) {
      // Pinned anchor wins, else the resolved active query — null while a transformation is
      // active, so Shift+Click plain-selects instead of ranging across card types.
      const anchorRefId = queryAnchorRef.current ?? activeQueryRefIdRef.current;

      if (anchorRefId !== null) {
        const range = getContiguousRange(orderedIds, anchorRefId, query.refId);
        if (range) {
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
      // The toggled card becomes the anchor; the rest becomes the Shift-range base.
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

    // Seed from the resolved ids so the selection matches the card the editor is showing —
    // multi-select can never open with checkboxes visible but nothing checked.
    const transformationId = activeTransformationIdRef.current;
    if (transformationId !== null) {
      setSelectedQueryRefIds([]);
      setSelectedTransformationIds([transformationId]);
      transformationAnchorRef.current = transformationId;
      return;
    }

    const queryRefId = activeQueryRefIdRef.current;
    if (queryRefId !== null) {
      setSelectedTransformationIds([]);
      setSelectedQueryRefIds([queryRefId]);
      queryAnchorRef.current = queryRefId;
    }
  }, [resetSelectionAnchors]);

  const clearSelection = useCallback(() => {
    // Null raw ids resolve to queries[0].
    setRawActiveQueryRefId(null);
    setRawActiveTransformationId(null);
    clearMultiSelection();
    onClearSideEffectsRef.current?.();
  }, [clearMultiSelection]);

  const removeQueryFromSelection = useCallback((refId: string) => {
    setSelectedQueryRefIds((current) => current.filter((id) => id !== refId));
    // Null the raw id rather than pick a successor — `queries` may still contain the
    // deleted item this render, so any successor chosen here could be stale.
    setRawActiveQueryRefId((current) => (current === refId ? null : current));
    if (queryAnchorRef.current === refId) {
      queryAnchorRef.current = null;
    }
    queryRangeBaseRef.current = queryRangeBaseRef.current.filter((id) => id !== refId);
  }, []);

  const removeTransformationFromSelection = useCallback((transformId: string) => {
    setSelectedTransformationIds((current) => current.filter((id) => id !== transformId));
    setRawActiveTransformationId((current) => (current === transformId ? null : current));
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
