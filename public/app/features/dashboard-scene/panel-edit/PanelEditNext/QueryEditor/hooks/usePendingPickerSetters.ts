import { useCallback } from 'react';

import { type PendingExpression, type PendingSavedQuery, type PendingTransformation } from '../QueryEditorContext';

interface UsePendingPickerSettersArgs {
  /** Called when any picker opens — pickers and stacked mode are mutually exclusive. */
  exitStackedMode: () => void;
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
 * can be pending at a time, and opening any picker exits stacked mode. Closing a picker
 * (writing null) is a no-op for stacked mode and for the other pickers.
 *
 * Returned setters are stable for the component lifetime (assuming their inputs are), so they
 * can live in `uiState` without triggering downstream re-renders on every selection change.
 */
export function usePendingPickerSetters({
  exitStackedMode,
  setPendingExpression: rawSetPendingExpression,
  setPendingTransformation: rawSetPendingTransformation,
  setPendingSavedQuery: rawSetPendingSavedQuery,
}: UsePendingPickerSettersArgs): UsePendingPickerSettersResult {
  const startPickerSession = useCallback(
    (opening: PickerKind) => {
      exitStackedMode();
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
    [exitStackedMode, rawSetPendingExpression, rawSetPendingTransformation, rawSetPendingSavedQuery]
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
