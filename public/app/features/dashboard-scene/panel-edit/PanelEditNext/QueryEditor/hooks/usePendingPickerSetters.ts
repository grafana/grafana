import { useCallback } from 'react';

import { type PendingExpression, type PendingSavedQuery, type PendingTransformation } from '../QueryEditorContext';

interface UsePendingPickerSettersArgs {
  /** Bare state writers for each picker, before this hook's cross-exclusion logic wraps them. */
  setPendingExpression: (pending: PendingExpression | null) => void;
  setPendingTransformation: (pending: PendingTransformation | null) => void;
  setPendingSavedQuery: (pending: PendingSavedQuery | null) => void;
}

interface UsePendingPickerSettersResult {
  setPendingExpression: (pending: PendingExpression | null) => void;
  setPendingTransformation: (pending: PendingTransformation | null) => void;
  setPendingSavedQuery: (pending: PendingSavedQuery | null) => void;
}

type PickerKind = 'expression' | 'transformation' | 'savedQuery';

/**
 * Wraps the three pending-picker setters with the cross-exclusion invariant: only one picker
 * can be pending at a time. Opening a picker clears the other two; closing one (writing null)
 * leaves the others untouched.
 *
 * Pickers intentionally do NOT change stacked mode. While an expression/transformation picker
 * is pending the content already falls back to the single pane (see QueryEditorContent), and
 * the saved-query picker is a drawer overlay — in both cases stacked view should resume once
 * the picker resolves rather than being torn down.
 *
 * Returned setters are stable for the component lifetime (assuming their inputs are), so they
 * can live in `uiState` without triggering downstream re-renders on every selection change.
 */
export function usePendingPickerSetters({
  setPendingExpression: rawSetPendingExpression,
  setPendingTransformation: rawSetPendingTransformation,
  setPendingSavedQuery: rawSetPendingSavedQuery,
}: UsePendingPickerSettersArgs): UsePendingPickerSettersResult {
  const startPickerSession = useCallback(
    (opening: PickerKind) => {
      if (opening !== 'expression') {
        rawSetPendingExpression(null);
      }
      if (opening !== 'transformation') {
        rawSetPendingTransformation(null);
      }
      if (opening !== 'savedQuery') {
        rawSetPendingSavedQuery(null);
      }
    },
    [rawSetPendingExpression, rawSetPendingTransformation, rawSetPendingSavedQuery]
  );

  const setPendingExpression = useCallback(
    (pending: PendingExpression | null) => {
      if (pending) {
        startPickerSession('expression');
      }
      rawSetPendingExpression(pending);
    },
    [startPickerSession, rawSetPendingExpression]
  );

  const setPendingTransformation = useCallback(
    (pending: PendingTransformation | null) => {
      if (pending) {
        startPickerSession('transformation');
      }
      rawSetPendingTransformation(pending);
    },
    [startPickerSession, rawSetPendingTransformation]
  );

  const setPendingSavedQuery = useCallback(
    (pending: PendingSavedQuery | null) => {
      if (pending) {
        startPickerSession('savedQuery');
      }
      rawSetPendingSavedQuery(pending);
    },
    [startPickerSession, rawSetPendingSavedQuery]
  );

  return { setPendingExpression, setPendingTransformation, setPendingSavedQuery };
}
