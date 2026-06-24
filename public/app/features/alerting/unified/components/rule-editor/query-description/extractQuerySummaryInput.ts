import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

interface SummaryInput {
  expr: string;
  threshold?: { comparator: string; value: number };
}

const EVAL_TO_COMPARATOR: Record<string, string> = {
  [EvalFunction.IsAbove]: '>',
  [EvalFunction.IsBelow]: '<',
  [EvalFunction.IsEqual]: '==',
  [EvalFunction.IsNotEqual]: '!=',
  [EvalFunction.IsGreaterThanEqual]: '>=',
  [EvalFunction.IsLessThanEqual]: '<=',
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function getExpr(model: unknown): string | undefined {
  if (isRecord(model) && 'expr' in model && typeof model.expr === 'string') {
    return model.expr;
  }
  return undefined;
}

function getThreshold(model: unknown): SummaryInput['threshold'] | undefined {
  if (!isRecord(model) || !('conditions' in model)) {
    return undefined;
  }
  const conditions = model.conditions;
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return undefined;
  }
  const first = conditions[0];
  if (!first || typeof first !== 'object' || !('evaluator' in first)) {
    return undefined;
  }
  const evaluator = first.evaluator;
  if (!evaluator || typeof evaluator !== 'object' || !('type' in evaluator) || !('params' in evaluator)) {
    return undefined;
  }
  const evalType = String(evaluator.type);
  const comp = EVAL_TO_COMPARATOR[evalType];
  const params = evaluator.params;
  if (comp && Array.isArray(params) && params.length > 0 && typeof params[0] === 'number') {
    return { comparator: comp, value: params[0] };
  }
  return undefined;
}

export function extractQuerySummaryInput(
  queries: AlertQuery[],
  condition: string | null,
  cloudExpression?: string
): SummaryInput | undefined {
  const dataQuery = queries.find((q) => q.datasourceUid !== ExpressionDatasourceUID);
  const expr = getExpr(dataQuery?.model);

  let threshold: SummaryInput['threshold'] | undefined;

  if (condition) {
    const conditionQuery = queries.find((q) => q.refId === condition);
    if (conditionQuery) {
      threshold = getThreshold(conditionQuery.model);
    }
  }

  if (expr && expr.trim()) {
    return { expr, threshold };
  }

  if (cloudExpression && cloudExpression.trim()) {
    return { expr: cloudExpression, threshold };
  }

  return undefined;
}
