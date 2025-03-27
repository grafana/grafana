import { BuilderQueryEditorWhereExpressionArray, BuilderQueryExpression } from '../../dataquery.gen';

const appendWhere = (
  phrases: string[],
  timeFilter?: BuilderQueryEditorWhereExpressionArray,
  fuzzySearch?: BuilderQueryEditorWhereExpressionArray,
  where?: BuilderQueryEditorWhereExpressionArray
) => {
  const conditions: string[] = [];

  const addCondition = (exp: any) => {
    if (exp.operator?.name && exp.property?.name) {
      const val = String(exp.operator.value ?? '').trim();
      if (exp.operator.name === '$__timeFilter') {
        conditions.push(`$__timeFilter(${exp.property.name})`);
      } else {
        conditions.push(`${exp.property.name} ${exp.operator.name} '${val}'`);
      }
    }
  };

  timeFilter?.expressions?.forEach(addCondition);
  fuzzySearch?.expressions?.forEach(addCondition);
  where?.expressions?.forEach(addCondition);

  if (conditions.length > 0) {
    phrases.push(`where ${conditions.join(' and ')}`);
  }
};

const appendProject = (builderQuery: BuilderQueryExpression, phrases: string[]) => {
  const selectedColumns = builderQuery.columns?.columns || [];
  if (selectedColumns.length > 0) {
    phrases.push(`project ${selectedColumns.join(', ')}`);
  }
};

const appendSummarize = (builderQuery: BuilderQueryExpression, phrases: string[]) => {
  const summarizeAlreadyAdded = phrases.some((phrase) => phrase.startsWith('summarize'));
  const reduceExprs = builderQuery.reduce?.expressions ?? [];

  if (summarizeAlreadyAdded || reduceExprs.length === 0) {
    return;
  }

  const summarizeParts = reduceExprs
    .map((expr) => {
      if (!expr.reduce?.name) {
        return null;
      }

      const func = expr.reduce.name;

      if (func === 'percentile') {
        const percentileValue = expr.parameters?.[0]?.value;
        const column = expr.parameters?.[1]?.value ?? expr.property?.name ?? '';
        if (!column) {
          return null;
        }
        return `percentile(${percentileValue}, ${column})`;
      }

      const column = expr.property?.name ?? '';

      if (func === 'count') {
        return 'count()';
      }

      return column ? `${func}(${column})` : func;
    })
    .filter(Boolean);

  if (summarizeParts.length === 0) {
    return;
  }

  const groupBy = builderQuery.groupBy?.expressions?.map((exp) => exp.property?.name) || [];
  const summarizeClause = `summarize ${summarizeParts.join(', ')}`;
  phrases.push(groupBy.length ? `${summarizeClause} by ${groupBy.join(', ')}` : summarizeClause);
};

const appendOrderBy = (builderQuery: BuilderQueryExpression, phrases: string[]) => {
  const orderBy = builderQuery.orderBy?.expressions || [];
  if (!orderBy.length) {
    return;
  }

  const clauses = orderBy.map((order) => `${order.property?.name} ${order.order}`).filter(Boolean);
  if (clauses.length > 0) {
    phrases.push(`order by ${clauses.join(', ')}`);
  }
};

const appendLimit = (builderQuery: BuilderQueryExpression, phrases: string[]) => {
  if (builderQuery.limit && builderQuery.limit > 0) {
    phrases.push(`limit ${builderQuery.limit}`);
  }
};

const toQuery = (builderQuery: BuilderQueryExpression): string => {
  const { from, timeFilter, fuzzySearch, where } = builderQuery;
  if (!from?.property?.name) {
    return '';
  }

  const phrases: string[] = [];
  phrases.push(from.property.name);

  appendWhere(phrases, timeFilter, fuzzySearch, where);
  appendProject(builderQuery, phrases);
  appendSummarize(builderQuery, phrases);
  appendOrderBy(builderQuery, phrases);
  appendLimit(builderQuery, phrases);

  return phrases.join('\n| ');
};

export const AzureMonitorKustoQueryBuilder = {
  toQuery,
};
