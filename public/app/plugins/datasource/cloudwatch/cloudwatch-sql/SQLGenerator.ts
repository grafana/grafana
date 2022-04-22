import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import {
  QueryEditorArrayExpression,
  QueryEditorExpression,
  QueryEditorExpressionType,
  QueryEditorFunctionExpression,
  QueryEditorOperatorExpression,
  QueryEditorPropertyExpression,
} from '../expressions';
import { SQLExpression } from '../types';

export default class SQLGenerator {
  constructor(private templateSrv: TemplateSrv = getTemplateSrv()) {}

  expressionToSqlQuery({
    select,
    from,
    where,
    groupBy,
    orderBy,
    orderByDirection,
    limit,
  }: SQLExpression): string | undefined {
    if (!from || !select?.name || !select?.parameters?.length) {
      return undefined;
    }

    let parts: string[] = [];
    this.appendSelect(select, parts);
    this.appendFrom(from, parts);
    this.appendWhere(where, parts, true, where?.expressions?.length ?? 0);
    this.appendGroupBy(groupBy, parts);
    this.appendOrderBy(orderBy, orderByDirection, parts);
    this.appendLimit(limit, parts);

    return parts.join(' ');
  }

  private appendSelect(select: QueryEditorFunctionExpression | undefined, parts: string[]) {
    parts.push('SELECT');
    this.appendFunction(select, parts);
  }

  private appendFrom(from: QueryEditorPropertyExpression | QueryEditorFunctionExpression | undefined, parts: string[]) {
    parts.push('FROM');
    from?.type === QueryEditorExpressionType.Function
      ? this.appendFunction(from, parts)
      : parts.push(this.formatValue(from?.property?.name ?? ''));
  }

  private appendWhere(
    filter: QueryEditorExpression | undefined,
    parts: string[],
    isTopLevelExpression: boolean,
    topLevelExpressionsCount: number
  ) {
    if (!filter) {
      return;
    }

    const hasChildExpressions = 'expressions' in filter && filter.expressions.length > 0;
    if (isTopLevelExpression && hasChildExpressions) {
      parts.push('WHERE');
    }

    if (filter.type === QueryEditorExpressionType.And) {
      const andParts: string[] = [];
      filter.expressions.map((exp) => this.appendWhere(exp, andParts, false, topLevelExpressionsCount));
      if (andParts.length === 0) {
        return;
      }
      const andCombined = andParts.join(' AND ');
      const wrapInParentheses = !isTopLevelExpression && topLevelExpressionsCount > 1 && andParts.length > 1;
      return parts.push(wrapInParentheses ? `(${andCombined})` : andCombined);
    }

    if (filter.type === QueryEditorExpressionType.Or) {
      const orParts: string[] = [];
      filter.expressions.map((exp) => this.appendWhere(exp, orParts, false, topLevelExpressionsCount));
      if (orParts.length === 0) {
        return;
      }
      const orCombined = orParts.join(' OR ');
      const wrapInParentheses = !isTopLevelExpression && topLevelExpressionsCount > 1 && orParts.length > 1;
      parts.push(wrapInParentheses ? `(${orCombined})` : orCombined);
      return;
    }

    if (filter.type === QueryEditorExpressionType.Operator) {
      return this.appendOperator(filter, parts);
    }
  }

  private appendGroupBy(groupBy: QueryEditorArrayExpression | undefined, parts: string[]) {
    const groupByParts: string[] = [];
    for (const expression of groupBy?.expressions ?? []) {
      if (expression?.type !== QueryEditorExpressionType.GroupBy || !expression.property.name) {
        continue;
      }
      groupByParts.push(this.formatValue(expression.property.name));
    }

    if (groupByParts.length > 0) {
      parts.push(`GROUP BY ${groupByParts.join(', ')}`);
    }
  }

  private appendOrderBy(
    orderBy: QueryEditorFunctionExpression | undefined,
    orderByDirection: string | undefined,
    parts: string[]
  ) {
    if (orderBy) {
      parts.push('ORDER BY');
      this.appendFunction(orderBy, parts);
      parts.push(orderByDirection ?? 'ASC');
    }
  }

  private appendLimit(limit: number | undefined, parts: string[]) {
    limit && parts.push(`LIMIT ${limit}`);
  }

  private appendOperator(expression: QueryEditorOperatorExpression, parts: string[], prefix?: string) {
    const { property, operator } = expression;

    if (!property.name || !operator.name || !operator.value) {
      return;
    }

    parts.push(`${this.formatValue(property.name)} ${operator.name} '${operator.value}'`);
  }

  private appendFunction(select: QueryEditorFunctionExpression | undefined, parts: string[]) {
    if (!select?.name) {
      return;
    }

    const params = (select.parameters ?? [])
      .map((p) => p.name && this.formatValue(p.name))
      .filter(Boolean)
      .join(', ');

    parts.push(`${select.name}(${params})`);
  }

  private formatValue(label: string): string {
    const specialCharacters = /[/\s\.-]/; // slash, space, dot or dash

    const interpolated = this.templateSrv.replace(label, {}, 'raw');
    if (specialCharacters.test(interpolated)) {
      return `"${label}"`;
    }

    return label;
  }
}
