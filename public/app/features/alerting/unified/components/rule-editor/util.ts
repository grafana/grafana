import { ValidateResult } from 'react-hook-form';

import { isExpressionQuery } from 'app/features/expressions/guards';
import { AlertQuery } from 'app/types/unified-alerting-dto';

export function queriesWithUpdatedReferences(
  queries: AlertQuery[],
  previousRefId: string,
  newRefId: string
): AlertQuery[] {
  return queries.map((query) => {
    if (previousRefId === newRefId) {
      return query;
    }

    if (!isExpressionQuery(query.model)) {
      return query;
    }

    const isMathExpression = query.model.type === 'math';
    const isReduceExpression = query.model.type === 'reduce';
    const isResampleExpression = query.model.type === 'resample';
    const isClassicExpression = query.model.type === 'classic_conditions';

    if (isMathExpression) {
      return {
        ...query,
        model: {
          ...query.model,
          expression: updateMathExpressionRefs(query.model.expression ?? '', previousRefId, newRefId),
        },
      };
    }

    if (isResampleExpression || isReduceExpression) {
      const isReferencing = query.model.expression === previousRefId;

      return {
        ...query,
        model: {
          ...query.model,
          expression: isReferencing ? newRefId : query.model.expression,
        },
      };
    }

    if (isClassicExpression) {
      const conditions = query.model.conditions?.map((condition) => ({
        ...condition,
        query: {
          ...condition.query,
          params: condition.query.params.map((param: string) => (param === previousRefId ? newRefId : param)),
        },
      }));

      return { ...query, model: { ...query.model, conditions } };
    }

    return query;
  });
}

export function updateMathExpressionRefs(expression: string, previousRefId: string, newRefId: string): string {
  const oldExpression = new RegExp('(\\$' + previousRefId + '\\b)|(\\${' + previousRefId + '})', 'gm');
  const newExpression = '${' + newRefId + '}';

  return expression.replace(oldExpression, newExpression);
}

// some gateways (like Istio) will decode "/" and "\" characters – this will cause 404 errors for any API call
// that includes these values in the URL (ie. /my/path%2fto/resource -> /my/path/to/resource)
//
// see https://istio.io/latest/docs/ops/best-practices/security/#customize-your-system-on-path-normalization
export function checkForPathSeparator(value: string): ValidateResult {
  const containsPathSeparator = value.includes('/') || value.includes('\\');
  if (containsPathSeparator) {
    return 'Cannot contain "/" or "\\" characters';
  }

  return true;
}
