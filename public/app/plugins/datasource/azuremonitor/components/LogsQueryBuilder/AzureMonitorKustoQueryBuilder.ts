import {
  BuilderQueryEditorWhereExpression,
  BuilderQueryEditorWhereExpressionArray,
  BuilderQueryEditorWhereExpressionItems,
  BuilderQueryExpression,
} from '../../dataquery.gen';

const isNestedExpression = (
  exp: BuilderQueryEditorWhereExpression | BuilderQueryEditorWhereExpressionItems
): exp is BuilderQueryEditorWhereExpressionItems =>
  'operator' in exp &&
  'property' in exp &&
  typeof exp.operator?.name === 'string' &&
  typeof exp.property?.name === 'string';

const buildCondition = (
  exp: BuilderQueryEditorWhereExpression | BuilderQueryEditorWhereExpressionItems
): string | undefined => {
  if ('expressions' in exp && Array.isArray(exp.expressions)) {
    const isGroupOfFilters = exp.expressions.every((e) => 'operator' in e && 'property' in e);

    const nested = exp.expressions.map(buildCondition).filter((c): c is string => Boolean(c));

    if (nested.length === 0) {
      return;
    }

    const joiner = isGroupOfFilters ? ' or ' : ' and ';
    const joined = nested.join(joiner);

    return nested.length > 1 ? `(${joined})` : joined;
  }

  if (isNestedExpression(exp)) {
    const { name: op, value } = exp.operator;
    const { name: prop } = exp.property;
    const escapedValue = String(value).replace(/'/g, "''");
    return op === '$__timeFilter' ? `$__timeFilter(${prop})` : `${prop} ${op} '${escapedValue}'`;
  }

  return;
};

export const appendWhere = (
  phrases: string[],
  timeFilter?: BuilderQueryEditorWhereExpressionArray,
  fuzzySearch?: BuilderQueryEditorWhereExpressionArray,
  where?: BuilderQueryEditorWhereExpressionArray
): void => {
  const groups = [timeFilter, fuzzySearch, where];

  groups.forEach((group) => {
    group?.expressions.forEach((exp) => {
      const condition = buildCondition(exp);
      if (condition) {
        phrases.push(`where ${condition}`);
      }
    });
  });
};

const appendProject = (builderQuery: BuilderQueryExpression, phrases: string[]) => {
  const selectedColumns = builderQuery.columns?.columns || [];
  if (selectedColumns.length > 0) {
    phrases.push(`project ${selectedColumns.join(', ')}`);
  }
};

const appendSummarize = (builderQuery: BuilderQueryExpression, phrases: string[]) => {
  const summarizeAlreadyAdded = phrases.some((phrase) => phrase.startsWith('summarize'));
  if (summarizeAlreadyAdded) {
    return;
  }

  const reduceExprs = builderQuery.reduce?.expressions ?? [];
  const groupBy = builderQuery.groupBy?.expressions?.map((exp) => exp.property?.name).filter(Boolean) ?? [];

  const summarizeParts = reduceExprs
    .map((expr) => {
      if (!expr.reduce?.name) {
        return;
      }

      const func = expr.reduce.name;

      if (func === 'percentile') {
        const percentileValue = expr.parameters?.[0]?.value;
        const column = expr.parameters?.[1]?.value ?? expr.property?.name ?? '';
        return column ? `percentile(${percentileValue}, ${column})` : null;
      }

      const column = expr.property?.name ?? '';
      return func === 'count' ? 'count()' : column ? `${func}(${column})` : func;
    })
    .filter(Boolean);

  if (summarizeParts.length === 0 && groupBy.length === 0) {
    return;
  }

  const summarizeClause =
    summarizeParts.length > 0
      ? `summarize ${summarizeParts.join(', ')}${groupBy.length > 0 ? ` by ${groupBy.join(', ')}` : ''}`
      : `summarize by ${groupBy.join(', ')}`;

  phrases.push(summarizeClause);
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
