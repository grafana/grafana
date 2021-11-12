import { isExpressionQuery } from 'app/features/expressions/guards';
import { AlertQuery } from 'app/types/unified-alerting-dto';

export function queriesWithUpdatedReferences(
  queries: AlertQuery[],
  previousRefId: string,
  newRefId: string
): AlertQuery[] {
  return queries.map((query) => {
    if (!isExpressionQuery(query.model)) {
      return query;
    }

    const isMathExpression = query.model.type === 'math';
    const isReduceExpression = query.model.type === 'reduce';
    const isResampleExpression = query.model.type === 'resample';
    const isClassicExpression = query.model.type === 'classic_conditions';

    if (isMathExpression) {
      const oldExpression = new RegExp(`\\$\{?${previousRefId}\}?`, 'gm');
      const newExpression = `\${${newRefId}}`;

      return {
        ...query,
        model: {
          ...query.model,
          expression: query.model.expression?.replace(oldExpression, newExpression),
        },
      };
    }

    if (isResampleExpression || isReduceExpression) {
      return {
        ...query,
        model: {
          ...query.model,
          expression: newRefId,
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
