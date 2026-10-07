import { useCallback, useState } from 'react';

import { type DataQuery } from '@grafana/schema';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { type ExpressionQueryType } from 'app/features/expressions/types';
import { getDefaults } from 'app/features/expressions/utils/expressionTypes';

import { type PendingExpression } from '../QueryEditorContext';

interface UsePendingExpressionOptions {
  addQuery: (query?: Partial<DataQuery>, afterRefId?: string) => string | undefined;
  onCardSelectionChange: (queryRefId: string | null, transformationId: string | null) => void;
}

export function usePendingExpression({ addQuery, onCardSelectionChange }: UsePendingExpressionOptions) {
  const [pendingExpression, setPendingExpressionState] = useState<PendingExpression | null>(null);

  const setPendingExpression = useCallback((pending: PendingExpression | null) => {
    // Don't touch card selection on open: the picker renders purely off pending state
    // (via getEditorType / hasPendingPicker), so deselecting would wipe the bulk
    // selection and leave multi-select mode in an inconsistent state on cancel.
    setPendingExpressionState(pending);
  }, []);

  const finalizePendingExpression = useCallback(
    (type: ExpressionQueryType) => {
      const insertAfterRefId = pendingExpression?.insertAfter;
      setPendingExpressionState(null);

      const baseQuery = expressionDatasource.newQuery();
      const queryWithType = { ...baseQuery, type };
      const queryWithDefaults = getDefaults(queryWithType);

      const newRefId = addQuery(queryWithDefaults, insertAfterRefId);
      if (newRefId) {
        onCardSelectionChange(newRefId, null);
      }
    },
    [pendingExpression, addQuery, onCardSelectionChange]
  );

  const clearPendingExpression = useCallback(() => {
    setPendingExpressionState(null);
  }, []);

  return {
    pendingExpression,
    setPendingExpression,
    finalizePendingExpression,
    clearPendingExpression,
  };
}
