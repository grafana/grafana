import { useCallback, useMemo, useRef, useState } from 'react';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem, type StackedEditorState } from '../QueryEditorContext';

interface UseStackedModeOrchestrationArgs {
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

/**
 * Owns the stacked-mode state machine: the on/off boolean, the imperative scroll bridge,
 * and the `enter` / `exit` / `syncActiveItem` callbacks.
 *
 * Lives outside `QueryEditorContextWrapper` so the wrapper doesn't carry the stacked-only
 * plumbing inline. The wrapper composes this hook and exposes the returned `stackedMode`
 * on its context. Callers that need to force-exit reach for `stackedMode.exit`.
 */
export function useStackedModeOrchestration({
  onCardSelectionChange,
  selectedQueryRefIds,
  selectedTransformationIds,
  onEnter,
}: UseStackedModeOrchestrationArgs): StackedEditorState {
  const [isStackedMode, setIsStackedMode] = useState(false);

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
    // Prefer the most-recently-selected transformation as the primary card. Transformations are
    // downstream of queries in the pipeline, so if both are selected the user is most likely
    // working on the transformation step.
    const primaryTransformationId = selectedTransformationIdsRef.current.at(-1);
    const primaryQueryRefId = selectedQueryRefIdsRef.current.at(-1);
    if (primaryTransformationId) {
      onCardSelectionChange(null, primaryTransformationId);
    } else if (primaryQueryRefId) {
      onCardSelectionChange(primaryQueryRefId, null);
    }
    setIsStackedMode(true);
  }, [onCardSelectionChange]);

  const exit = useCallback(() => {
    setIsStackedMode(false);
  }, []);

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

  return useMemo<StackedEditorState>(
    () => ({
      enabled: isStackedMode,
      enter,
      exit,
      syncActiveItem,
    }),
    [isStackedMode, enter, exit, syncActiveItem]
  );
}
