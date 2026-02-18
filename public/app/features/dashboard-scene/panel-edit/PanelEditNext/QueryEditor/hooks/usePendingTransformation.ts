import { useCallback, useState } from 'react';

import { PendingTransformation } from '../QueryEditorContext';

interface UsePendingTransformationOptions {
  addTransformation: (transformationId: string, afterTransformId?: string) => string | undefined;
  onCardSelectionChange: (queryRefId: string | null, transformationId: string | null) => void;
}

export function usePendingTransformation({
  addTransformation,
  onCardSelectionChange,
}: UsePendingTransformationOptions) {
  const [pendingTransformation, setPendingTransformationState] = useState<PendingTransformation | null>(null);

  const setPendingTransformation = useCallback(
    (pending: PendingTransformation | null) => {
      setPendingTransformationState(pending);
      if (pending) {
        onCardSelectionChange(null, null);
      }
    },
    [onCardSelectionChange]
  );

  const finalizePendingTransformation = useCallback(
    (transformationId: string) => {
      const insertAfterTransformId = pendingTransformation?.insertAfter;
      setPendingTransformationState(null);

      const newTransformId = addTransformation(transformationId, insertAfterTransformId);
      if (newTransformId) {
        onCardSelectionChange(null, newTransformId);
      }
    },
    [pendingTransformation, addTransformation, onCardSelectionChange]
  );

  const clearPendingTransformation = useCallback(() => {
    setPendingTransformationState(null);
  }, []);

  return {
    pendingTransformation,
    setPendingTransformation,
    finalizePendingTransformation,
    clearPendingTransformation,
  };
}
