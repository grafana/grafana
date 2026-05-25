import { useCallback } from 'react';

import { type PendingExpression, type PendingSavedQuery, type PendingTransformation } from '../QueryEditorContext';

interface UsePendingPickerSettersArgs {
  /** Exits stacked mode whenever a picker is opened — pickers and stacked mode are mutually exclusive. */
  setStackedModeForView: (enabled: boolean) => void;
  /** Underlying state setters from each picker's owning hook (or local state). */
  setPendingExpressionRaw: (pending: PendingExpression | null) => void;
  setPendingTransformationRaw: (pending: PendingTransformation | null) => void;
  setPendingSavedQueryRaw: (pending: PendingSavedQuery | null) => void;
  /** Clearers for the picker hooks that own their own state machine. */
  clearPendingExpression: () => void;
  clearPendingTransformation: () => void;
}

interface UsePendingPickerSettersResult {
  setPendingExpression: (pending: PendingExpression | null) => void;
  setPendingTransformation: (pending: PendingTransformation | null) => void;
  setPendingSavedQuery: (pending: PendingSavedQuery | null) => void;
}

type PickerKind = 'expression' | 'transformation' | 'savedQuery';

/**
 * Wraps the three pending-picker setters with the cross-exclusion invariant: only one picker can be
 * pending at a time, and opening any picker exits stacked mode. Returned setters are stable for the
 * component lifetime (assuming their inputs are stable), so they can live in `uiState` without
 * triggering downstream re-renders on every selection change.
 */
export function usePendingPickerSetters({
  setStackedModeForView,
  setPendingExpressionRaw,
  setPendingTransformationRaw,
  setPendingSavedQueryRaw,
  clearPendingExpression,
  clearPendingTransformation,
}: UsePendingPickerSettersArgs): UsePendingPickerSettersResult {
  const startPickerSession = useCallback(
    (opening: PickerKind) => {
      setStackedModeForView(false);
      if (opening !== 'expression') {
        clearPendingExpression();
      }
      if (opening !== 'transformation') {
        clearPendingTransformation();
      }
      if (opening !== 'savedQuery') {
        setPendingSavedQueryRaw(null);
      }
    },
    [setStackedModeForView, clearPendingExpression, clearPendingTransformation, setPendingSavedQueryRaw]
  );

  const setPendingExpression = useCallback(
    (pending: PendingExpression | null) => {
      if (pending) {
        startPickerSession('expression');
      }
      setPendingExpressionRaw(pending);
    },
    [startPickerSession, setPendingExpressionRaw]
  );

  const setPendingTransformation = useCallback(
    (pending: PendingTransformation | null) => {
      if (pending) {
        startPickerSession('transformation');
      }
      setPendingTransformationRaw(pending);
    },
    [startPickerSession, setPendingTransformationRaw]
  );

  const setPendingSavedQuery = useCallback(
    (pending: PendingSavedQuery | null) => {
      if (pending) {
        startPickerSession('savedQuery');
      }
      setPendingSavedQueryRaw(pending);
    },
    [startPickerSession, setPendingSavedQueryRaw]
  );

  return { setPendingExpression, setPendingTransformation, setPendingSavedQuery };
}
