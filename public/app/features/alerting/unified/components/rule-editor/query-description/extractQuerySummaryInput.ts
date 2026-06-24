import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { type ExpressionQuery } from 'app/features/expressions/types';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { type ThresholdInfo } from './compileQueryDescription';

const EVAL_FUNCTION_TO_COMPARATOR: Partial<Record<EvalFunction, string>> = {
  [EvalFunction.IsAbove]: '>',
  [EvalFunction.IsBelow]: '<',
  [EvalFunction.IsEqual]: '==',
  [EvalFunction.IsNotEqual]: '!=',
  [EvalFunction.IsGreaterThanEqual]: '>=',
  [EvalFunction.IsLessThanEqual]: '<=',
};

export interface QuerySummaryInput {
  expr: string;
  threshold?: ThresholdInfo;
}

function readExpr(model: AlertDataQuery | ExpressionQuery): string | undefined {
  // Prometheus/Loki datasource queries carry the expression on `expr`, which isn't
  // declared on the model union — narrow at runtime rather than asserting.
  if ('expr' in model && typeof model.expr === 'string' && model.expr.trim()) {
    return model.expr.trim();
  }
  return undefined;
}

/**
 * Reads a threshold out of the condition's expression query (a separate `threshold`
 * node), so the description can state the firing condition even when the data query
 * has no inline comparison — the common shape for Grafana-managed rules.
 */
function extractThreshold(queries: AlertQuery[], condition: string | null): ThresholdInfo | undefined {
  const model = queries.find((query) => query.refId === condition)?.model;
  if (!model || !('conditions' in model)) {
    return undefined;
  }
  const evaluator = model.conditions?.[0]?.evaluator;
  if (!evaluator?.params?.length) {
    return undefined;
  }
  const comparator = EVAL_FUNCTION_TO_COMPARATOR[evaluator.type];
  if (!comparator) {
    return undefined;
  }
  return { comparator, value: String(evaluator.params[0]) };
}

/**
 * Extracts the alert's query expression (and any separate threshold) from the rule
 * form. Handles Grafana-managed rules (expression on a data query in `queries`) and
 * cloud rules (a single expression string), returning undefined when neither is set.
 */
export function extractQuerySummaryInput(
  queries: AlertQuery[],
  condition: string | null,
  cloudExpression?: string
): QuerySummaryInput | undefined {
  for (const query of queries) {
    const expr = readExpr(query.model);
    if (expr) {
      return { expr, threshold: extractThreshold(queries, condition) };
    }
  }

  if (cloudExpression?.trim()) {
    return { expr: cloudExpression.trim() };
  }

  return undefined;
}
