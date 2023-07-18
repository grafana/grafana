import lucene, { AST, NodeTerm } from 'lucene';

import { escapeRegex } from '@grafana/data';

type ModifierType = '' | '-';

// @ts-ignore
window.lucene = lucene;
// @ts-ignore
window.queryHasFilter = queryHasFilter;

/**
 * Checks for the presence of a given label:"value" filter in the query.
 */
export function queryHasFilter(query: string, key: string, value: string, modifier: ModifierType = ''): boolean {
  const field = `${modifier}${lucene.term.escape(key)}`;
  let ast: AST | null = null;
  try {
    ast = lucene.parse(normalizeQuery(query));
  } catch (e) {
    console.log(query);
    return false;
  }

  let node = getNode(ast);
  while (node) {
    if (node.field === field && node.term === value) {
      return true;
    }
    if (getNextAST(ast)) {
      ast = getNextAST(ast);
      node = getNode(ast);
    } else {
      node = getNextNode(ast);
      ast = null;
    }
  }

  return false;
}

/**
 * Adds a label:"value" expression to the query.
 */
export function addFilterToQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {
  if (queryHasFilter(query, key, value, modifier)) {
    return query;
  }

  key = escapeFilter(key);
  const filter = `${modifier}${key}:"${value}"`;

  return query === '' ? filter : `${query} AND ${filter}`;
}

function getFilterRegex(key: string, value: string) {
  return new RegExp(`[-]{0,1}\\s*${escapeRegex(key)}\\s*:\\s*["']{0,1}${escapeRegex(value)}["']{0,1}`, 'ig');
}

/**
 * Removes a label:"value" expression from the query.
 */
export function removeFilterFromQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {
  key = escapeFilter(key);
  const regex = getFilterRegex(key, value);
  const matches = query.matchAll(regex);
  const opRegex = new RegExp(`\\s+(?:AND|OR)\\s*$|^\\s*(?:AND|OR)\\s+`, 'ig');
  for (const match of matches) {
    if (modifier === '-' && match[0].startsWith(modifier)) {
      query = query.replace(regex, '').replace(opRegex, '');
    }
    if (modifier === '' && !match[0].startsWith('-')) {
      query = query.replace(regex, '').replace(opRegex, '');
    }
  }
  query = query.replace(/AND\s+OR/gi, 'OR');
  query = query.replace(/OR\s+AND/gi, 'AND');
  return query;
}

/**
 * Filters can possibly contain colons, which are used as a separator in the query.
 * Use this function to escape filter keys.
 */
export function escapeFilter(value: string) {
  return value.replace(/:/g, '\\:');
}

/**
 * Normalizes the query by removing whitespace around colons, which breaks parsing.
 */
function normalizeQuery(query: string) {
  return query.replace(/\s+:\s+/g, ':');
}

/**
 * Given an AST, resolve the NodeTerm:
 * - if it's a NodeTerm, return it
 * - if left is defined and is a NodeTerm, return it
 * - otherwise return null
 */
function getNode(ast: AST | null): NodeTerm | null {
  if (!ast) {
    return null;
  }
  if ('term' in ast) {
    return ast;
  }
  if ('left' in ast && 'term' in ast.left) {
    return ast.left;
  }
  return null;
}

/**
 * Given an AST, resolve the next AST:
 * - if right is defined and is a NodeTerm, return it
 * - otherwise return null
 */
function getNextAST(ast: AST | null): AST | null {
  if (!ast) {
    return null;
  }
  if (!('right' in ast)) {
    return null;
  }
  if ('left' in ast.right) {
    return ast.right;
  }
  return null;
}

/**
 * When the NextAST is null, resolve the NodeTerm from the current AST:
 * - if right is defined and is a NodeTerm, return it
 * - otherwise return null
 */
function getNextNode(ast: AST | null): NodeTerm | null {
  if (!ast) {
    return null;
  }
  if (!('right' in ast)) {
    return null;
  }
  if ('term' in ast.right) {
    return ast.right;
  }
  return null;
}
