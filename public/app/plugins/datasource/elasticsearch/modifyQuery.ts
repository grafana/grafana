import lucene, { AST, BinaryAST, LeftOnlyAST, NodeTerm } from 'lucene';

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
  let ast: AST | null = null;
  try {
    ast = lucene.parse(normalizeQuery(query));
  } catch (e) {
    return null;
  }

  if (!ast) {
    return null;
  }

  return findNodeInTree(ast, field, value);
}

function findNodeInTree(tree: AST, field: string, value: string): NodeTerm | null {
  let ast: AST | null = tree;
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

  key = lucene.term.escape(key);
  const filter = `${modifier}${key}:"${value}"`;

  return query === '' ? filter : `${query} AND ${filter}`;
}

/**
 * Removes a label:"value" expression from the query.
 */
export function removeFilterFromQuery(query: string, key: string, value: string, modifier: ModifierType = ''): string {
  const node = findFilterNode(query, key, value, modifier);
  if (!node) {
    return query;
  }
  query = normalizeQuery(query);
  query = query.substring(0, node.fieldLocation?.start.offset) + query.substring(node.termLocation?.end.offset);
  query = query.replace(/AND\s+OR/gi, 'OR');
  query = query.replace(/OR\s+AND/gi, 'AND');
  query = query.replace(/^\s*(AND|OR)|(AND|OR)\s*$/gi, '').trim();

  return query;
}

/**
 * Filters can possibly contain colons, which are used as a separator in the query.
 * Use this function to escape filter keys.
 */
export function escapeFilter(value: string) {
  return lucene.term.escape(value);
}

/**
 * Normalizes the query by removing whitespace around colons, which breaks parsing.
 */
function normalizeQuery(query: string) {
  return query.replace(/\s+:\s+/g, ':');
}

function isLeftOnlyAST(ast: unknown): ast is LeftOnlyAST {
  if (!ast) {
    return false;
  }
  if ('left' in ast && !('right' in ast)) {
    return true;
  }
  return false;
}

function isBinaryAST(ast: unknown): ast is BinaryAST {
  if (!ast) {
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
  if (!ast) {
    return false;
  }
  if ('term' in ast) {
    return true;
  }
  return false;
}
