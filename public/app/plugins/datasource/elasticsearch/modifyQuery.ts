import { isEqual } from 'lodash';
import lucene, { AST, BinaryAST, LeftOnlyAST, NodeTerm } from 'lucene';

import { AdHocVariableFilter } from '@grafana/data';

type ModifierType = '' | '-';

/**
 * Checks for the presence of a given label:"value" filter in the query.
 */
export function queryHasFilter(query: string, key: string, value: string, modifier: ModifierType = ''): boolean {
  return findFilterNode(query, key, value, modifier) !== null;
}

/**
 * Given a query, find the NodeTerm that matches the given field and value.
 */
export function findFilterNode(
  query: string,
  key: string,
  value: string,
  modifier: ModifierType = ''
): NodeTerm | null {
  const field = `${modifier}${lucene.term.escape(key)}`;
  value = lucene.phrase.escape(value);
  let ast: AST | null = parseQuery(query);
  if (!ast) {
    return null;
  }

  return findNodeInTree(ast, field, value);
}

function findNodeInTree(ast: AST, field: string, value: string): NodeTerm | null {
  // {}
  if (Object.keys(ast).length === 0) {
    return null;
  }
  // { left: {}, right: {} } or { left: {} }
  if (isAST(ast.left)) {
    return findNodeInTree(ast.left, field, value);
  }
  if (isNodeTerm(ast.left) && ast.left.field === field && ast.left.term === value) {
    return ast.left;
  }
  if (isLeftOnlyAST(ast)) {
    return null;
  }
  if (isNodeTerm(ast.right) && ast.right.field === field && ast.right.term === value) {
    return ast.right;
  }
  if (isBinaryAST(ast.right)) {
    return findNodeInTree(ast.right, field, value);
  }
  return null;
}

/**
 * Adds a label:"value" expression to the query.
 */
export function addFilterToQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {
  if (queryHasFilter(query, key, value, modifier)) {
    return query;
  }

  key = escapeFilter(key);
  value = escapeFilterValue(value);
  const filter = `${modifier}${key}:"${value}"`;

  return concatenate(query, filter);
}

/**
 * Merge a query with a filter.
 */
function concatenate(query: string, filter: string, condition = 'AND'): string {
  if (!filter) {
    return query;
  }
  return query.trim() === '' ? filter : `${query} ${condition} ${filter}`;
}

/**
 * Adds a label:"value" expression to the query.
 */
export function addAddHocFilter(query: string, filter: AdHocVariableFilter): string {
  if (!filter.key || !filter.value) {
    return query;
  }

  filter = {
    ...filter,
    // Type is defined as string, but it can be a number.
    value: filter.value.toString(),
  };

  const equalityFilters = ['=', '!='];
  if (equalityFilters.includes(filter.operator)) {
    return addFilterToQuery(query, filter.key, filter.value, filter.operator === '=' ? '' : '-');
  }
  /**
   * Keys and values in ad hoc filters may contain characters such as
   * colons, which needs to be escaped.
   */
  const key = escapeFilter(filter.key);
  const value = escapeFilterValue(filter.value);
  const regexValue = escapeFilterValue(filter.value, false);
  let addHocFilter = '';
  switch (filter.operator) {
    case '=~':
      addHocFilter = `${key}:/${regexValue}/`;
      break;
    case '!~':
      addHocFilter = `-${key}:/${regexValue}/`;
      break;
    case '>':
      addHocFilter = `${key}:>${value}`;
      break;
    case '<':
      addHocFilter = `${key}:<${value}`;
      break;
  }
  return concatenate(query, addHocFilter);
}

/**
 * Removes a label:"value" expression from the query.
 */
export function removeFilterFromQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {
  const node = findFilterNode(query, key, value, modifier);
  const ast = parseQuery(query);
  if (!node || !ast) {
    return query;
  }

  return lucene.toString(removeNodeFromTree(ast, node));
}

function removeNodeFromTree(ast: AST, node: NodeTerm): AST {
  // {}
  if (Object.keys(ast).length === 0) {
    return ast;
  }
  // { left: {}, right: {} } or { left: {} }
  if (isAST(ast.left)) {
    ast.left = removeNodeFromTree(ast.left, node);
    return ast;
  }
  if (isNodeTerm(ast.left) && isEqual(ast.left, node)) {
    Object.assign(
      ast,
      {
        left: undefined,
        operator: undefined,
        right: undefined,
      },
      'right' in ast ? ast.right : {}
    );
    return ast;
  }
  if (isLeftOnlyAST(ast)) {
    return ast;
  }
  if (isNodeTerm(ast.right) && isEqual(ast.right, node)) {
    Object.assign(ast, {
      right: undefined,
      operator: undefined,
    });
    return ast;
  }
  if (isBinaryAST(ast.right)) {
    ast.right = removeNodeFromTree(ast.right, node);
    return ast;
  }
  return ast;
}

/**
 * Filters can possibly reserved characters such as colons which are part of the Lucene syntax.
 * Use this function to escape filter keys.
 */
export function escapeFilter(value: string) {
  return lucene.term.escape(value);
}

/**
 * Values can possibly reserved special characters such as quotes.
 * Use this function to escape filter values.
 */
export function escapeFilterValue(value: string, escapeBackslash = true) {
  if (escapeBackslash) {
    value = value.replace(/\\/g, '\\\\');
  }
  return lucene.phrase.escape(value);
}

/**
 * Normalizes the query by removing whitespace around colons, which breaks parsing.
 */
function normalizeQuery(query: string) {
  return query.replace(/(\w+)\s(:)/gi, '$1$2');
}

function isLeftOnlyAST(ast: unknown): ast is LeftOnlyAST {
  if (!ast || typeof ast !== 'object') {
    return false;
  }

  if ('left' in ast && !('right' in ast)) {
    return true;
  }

  return false;
}

function isBinaryAST(ast: unknown): ast is BinaryAST {
  if (!ast || typeof ast !== 'object') {
    return false;
  }

  if ('left' in ast && 'right' in ast) {
    return true;
  }
  return false;
}

function isAST(ast: unknown): ast is AST {
  return isLeftOnlyAST(ast) || isBinaryAST(ast);
}

function isNodeTerm(ast: unknown): ast is NodeTerm {
  if (ast && typeof ast === 'object' && 'term' in ast) {
    return true;
  }

  return false;
}

function parseQuery(query: string) {
  try {
    return lucene.parse(normalizeQuery(query));
  } catch (e) {
    return null;
  }
}

export function addStringFilterToQuery(query: string, filter: string, contains = true) {
  const expression = `"${escapeFilterValue(filter)}"`;
  return query.trim() ? `${query} ${contains ? 'AND' : 'NOT'} ${expression}` : `${contains ? '' : 'NOT '}${expression}`;
}
