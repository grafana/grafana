import { useMemo } from 'react';

import { DataQuery } from '@grafana/schema';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery } from 'app/features/expressions/types';

import { ActiveContext } from '../QueryEditorContext';
import { AlertRule, Transformation } from '../types';

/**
 * Resolves the currently selected query, transformation, or alert from the
 * active context. They are mutually exclusive — enforced structurally by the
 * DataSelection discriminated union on ActiveContext.
 *
 * - expressionPicker / transformationPicker → no card selected (picker is active)
 * - none → falls back to the first non-expression query so the editor is never blank
 * - query → resolved by refId; falls back to first non-expression query
 * - expression → resolved by refId; no fallback (expressions are explicit)
 * - transformation / alert → resolved by id from the data arrays
 */
export function useSelectedCard(
  activeContext: ActiveContext,
  queries: DataQuery[],
  transformations: Transformation[],
  alerts: AlertRule[]
) {
  const selectedExpression = useMemo((): ExpressionQuery | null => {
    if (activeContext.view !== 'data') {
      return null;
    }
    const { selection } = activeContext;
    if (selection.kind !== 'expression') {
      return null;
    }
    const found = queries.find((q) => q.refId === selection.refId);
    return found && isExpressionQuery(found) ? (found as ExpressionQuery) : null;
  }, [activeContext, queries]);

  const selectedQuery = useMemo((): DataQuery | null => {
    if (activeContext.view !== 'data') {
      return null;
    }

    const { selection } = activeContext;

    if (selection.kind === 'expressionPicker' || selection.kind === 'transformationPicker') {
      return null;
    }

    if (selection.kind === 'transformation' || selection.kind === 'expression') {
      return null;
    }

    if (selection.kind === 'query') {
      const found = queries.find((q) => q.refId === selection.refId);
      if (found && !isExpressionQuery(found)) {
        return found;
      }
      // Fall back to the first non-expression query if the selected refId was removed
      return queries.find((q) => !isExpressionQuery(q)) ?? null;
    }

    // kind === 'none' — fall back to first non-expression query so editor is never blank
    return queries.find((q) => !isExpressionQuery(q)) ?? null;
  }, [activeContext, queries]);

  const selectedTransformation = useMemo(() => {
    if (activeContext.view !== 'data') {
      return null;
    }
    const { selection } = activeContext;
    if (selection.kind !== 'transformation') {
      return null;
    }
    return transformations.find((t) => t.transformId === selection.id) ?? null;
  }, [activeContext, transformations]);

  const selectedAlert = useMemo(() => {
    if (activeContext.view !== 'alerts' || !activeContext.alertId) {
      return null;
    }
    return alerts.find((a) => a.alertId === activeContext.alertId) ?? null;
  }, [activeContext, alerts]);

  return { selectedQuery, selectedExpression, selectedTransformation, selectedAlert };
}
