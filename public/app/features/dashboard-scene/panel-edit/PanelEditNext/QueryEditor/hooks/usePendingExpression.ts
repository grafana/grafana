import { useCallback, useState } from 'react';

import { DataQuery } from '@grafana/schema';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { getDefaults } from 'app/features/expressions/utils/expressionTypes';

import { PendingExpression } from '../QueryEditorContext';

interface UsePendingExpressionOptions {
  addQuery: (query?: Partial<DataQuery>, afterRefId?: string) => string | undefined;
  onCardSelectionChange: (queryRefId: string | null, transformationId: string | null) => void;
}

export function usePendingExpression({ addQuery, onCardSelectionChange }: UsePendingExpressionOptions) {
  const [pendingExpression, setPendingExpressionState] = useState<PendingExpression | null>(null);

  const setPendingExpression = useCallback(
    (pending: PendingExpression | null) => {
      setPendingExpressionState(pending);
      if (pending) {
        // Deselect any currently selected card so the content area shows the picker
        onCardSelectionChange(null, null);
      }
    },
    [onCardSelectionChange]
  );

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
