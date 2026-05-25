import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem, type StackedEditorState } from '../QueryEditorContext';

type ScrollHandler = (item: StackedEditorItem) => void;

interface UseStackedModeOrchestrationArgs {
  /** Notifies the viz pane layout when stacked mode toggles so it can animate the layout. */
  onStackedModeChange?: (enabled: boolean) => void;
  /**
   * Card selection writer. Used by `enter` to promote a primary item into the selection and
   * by `syncActiveItem` to mirror observer-driven activations back into selection state.
   */
  onCardSelectionChange: (queryRefId: string | null, transformationId: string | null) => void;
  selectedQueryRefIds: readonly string[];
  selectedTransformationIds: readonly string[];
  /**
   * Cross-mode cleanup invoked on `enter` (e.g. clear alert selection, exit multi-select).
   * Captured via ref so callers can pass an inline function without re-creating `enter`.
   */
  onEnter?: () => void;
}

interface UseStackedModeOrchestrationResult {
  /** Public stacked-mode API consumed via `uiState.stackedMode`. */
  stackedMode: StackedEditorState;
  /**
   * Imperative setter for paths that need to force-exit stacked mode without going through
   * `stackedMode.exit` (alert selection, picker setters, multi-select toggle).
   */
  setStackedModeForView: (enabled: boolean) => void;
}

/**
 * Owns the stacked-mode state machine: the on/off boolean, the imperative scroll bridge,
 * the `enter` / `exit` / `syncActiveItem` callbacks, and the unmount-cleanup effect that
 * restores the parent layout if the wrapper unmounts while stacked mode is still active.
 *
 * Lives outside `QueryEditorContextWrapper` so the wrapper doesn't carry the stacked-only
 * plumbing inline. The wrapper composes this hook and exposes `stackedMode` on its context.
 */
export function useStackedModeOrchestration({
  onStackedModeChange,
  onCardSelectionChange,
  selectedQueryRefIds,
  selectedTransformationIds,
  onEnter,
}: UseStackedModeOrchestrationArgs): UseStackedModeOrchestrationResult {
  const [isStackedMode, setIsStackedMode] = useState(false);

  // Imperative scroll bridge: the active StackedEditorRenderer publishes its scroll function
  // via `setScrollHandler`; consumers reach it through `requestScroll`. Stored on a ref (not
  // state) so renderer (re)registration during render doesn't trigger an extra re-render.
  const scrollHandlerRef = useRef<ScrollHandler | null>(null);
  const requestScroll = useCallback<ScrollHandler>((item) => {
    scrollHandlerRef.current?.(item);
  }, []);
  const setScrollHandler = useCallback((handler: ScrollHandler | null) => {
    scrollHandlerRef.current = handler;
  }, []);

  const setStackedModeForView = useCallback(
    (enabled: boolean) => {
      setIsStackedMode(enabled);
      onStackedModeChange?.(enabled);
    },
    [onStackedModeChange]
  );

  // Restore parent layout on unmount if stacked mode is still active. Refs keep the
  // cleanup effect's deps empty so it only runs on unmount, not on every toggle.
  const isStackedModeRef = useRef(isStackedMode);
  isStackedModeRef.current = isStackedMode;
  const onStackedModeChangeRef = useRef(onStackedModeChange);
  onStackedModeChangeRef.current = onStackedModeChange;
  useEffect(() => {
    return () => {
      if (isStackedModeRef.current) {
        onStackedModeChangeRef.current?.(false);
      }
    };
  }, []);

  // `enter` is invoked imperatively from a button click, so reading the latest selection
  // and onEnter via refs is safe and keeps `enter` referentially stable across selections.
  const selectedQueryRefIdsRef = useRef(selectedQueryRefIds);
  selectedQueryRefIdsRef.current = selectedQueryRefIds;
  const selectedTransformationIdsRef = useRef(selectedTransformationIds);
  selectedTransformationIdsRef.current = selectedTransformationIds;
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  const enter = useCallback(() => {
    onEnterRef.current?.();
    const primaryTransformationId = selectedTransformationIdsRef.current.at(-1);
    const primaryQueryRefId = selectedQueryRefIdsRef.current.at(-1);
    if (primaryTransformationId) {
      onCardSelectionChange(null, primaryTransformationId);
    } else if (primaryQueryRefId) {
      onCardSelectionChange(primaryQueryRefId, null);
    }
    setStackedModeForView(true);
  }, [onCardSelectionChange, setStackedModeForView]);

  const exit = useCallback(() => {
    setStackedModeForView(false);
  }, [setStackedModeForView]);

  const syncActiveItem = useCallback(
    (item: StackedEditorItem) => {
      if (item.type === QueryEditorType.Transformation) {
        onCardSelectionChange(null, item.id);
      } else {
        onCardSelectionChange(item.id, null);
      }
    },
    [onCardSelectionChange]
  );

  const stackedMode = useMemo<StackedEditorState>(
    () => ({
      enabled: isStackedMode,
      enter,
      exit,
      syncActiveItem,
      requestScroll,
      setScrollHandler,
    }),
    [isStackedMode, enter, exit, syncActiveItem, requestScroll, setScrollHandler]
  );

  return { stackedMode, setStackedModeForView };
}
