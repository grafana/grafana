import { MySQL } from '@codemirror/lang-sql';
import { type SyntaxNode } from '@lezer/common';

import { type DataQuery, type DataSourceRef } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime';

import { getQueryDatasourceRef } from '../hooks/getQueryDatasourceRef';

export function expressionReferences(
  query: DataQuery,
  queries: DataQuery[],
  inherited: DataSourceRef | undefined
): string[] {
  if (!isExpressionReference(getQueryDatasourceRef(query, inherited))) {
    return [];
  }
  if (
    'type' in query &&
    query.type === 'classic_conditions' &&
    'conditions' in query &&
    Array.isArray(query.conditions)
  ) {
    return query.conditions.flatMap((condition: unknown) => {
      if (!condition || typeof condition !== 'object' || !('query' in condition)) {
        return [];
      }
      const input = condition.query;
      if (!input || typeof input !== 'object' || !('params' in input) || !Array.isArray(input.params)) {
        return [];
      }
      return typeof input.params[0] === 'string' ? [input.params[0]] : [];
    });
  }
  if (!('expression' in query) || typeof query.expression !== 'string') {
    return [];
  }
  if ('type' in query && query.type === 'sql') {
    const names = sqlReferences(query.expression).map((name) => name.toLowerCase());
    // SQL backend table names are case-insensitive; include all colliding refIds conservatively.
    return queries.filter((candidate) => names.includes(candidate.refId.toLowerCase())).map((query) => query.refId);
  }
  const references = Array.from(
    query.expression.matchAll(/\$(?:\{([^}]+)\}|([A-Za-z0-9_]+))/g),
    (match) => match[1] ?? match[2]
  );
  return [query.expression.trim(), ...references];
}

function sqlReferences(text: string): string[] {
  const references = new Set<string>();
  const value = (node: SyntaxNode): string => text.slice(node.from, node.to);
  const identifier = (node: SyntaxNode): boolean => node.name === 'Identifier' || node.name === 'QuotedIdentifier';
  const unquote = (node: SyntaxNode): string => value(node).replace(/^`|`$/g, '').replace(/``/g, '`');
  const visit = (node: SyntaxNode, inheritedAliases: Set<string>): void => {
    const children: SyntaxNode[] = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
      children.push(child);
    }
    const aliases = new Set(inheritedAliases);
    if (children.some((child) => child.name === 'Keyword' && value(child).toUpperCase() === 'WITH')) {
      for (let index = 0; index < children.length - 2; index++) {
        if (
          identifier(children[index]) &&
          value(children[index + 1]).toUpperCase() === 'AS' &&
          children[index + 2].name === 'Parens'
        ) {
          aliases.add(unquote(children[index]).toLowerCase());
        }
      }
    }
    let inFrom = false;
    let tableExpected = false;
    for (const child of children) {
      const token = value(child).toUpperCase();
      if (child.name === 'Keyword') {
        if (token === 'FROM' || token === 'JOIN') {
          inFrom = true;
          tableExpected = true;
        } else if (
          ['WHERE', 'ON', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'UNION', 'EXCEPT', 'INTERSECT'].includes(token)
        ) {
          inFrom = false;
          tableExpected = false;
        }
      } else if (inFrom && token === ',') {
        tableExpected = true;
      } else if (tableExpected && identifier(child)) {
        const name = unquote(child);
        if (!aliases.has(name.toLowerCase())) {
          references.add(name);
        }
        tableExpected = false;
      } else if (child.name === 'Parens') {
        visit(child, aliases);
        tableExpected = false;
      } else if (child.name === 'Statement') {
        visit(child, aliases);
      }
    }
  };
  visit(MySQL.language.parser.parse(text).topNode, new Set());
  return [...references];
}
