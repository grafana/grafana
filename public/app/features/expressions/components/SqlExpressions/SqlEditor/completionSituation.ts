import { syntaxTree } from '@codemirror/language';
import { type SyntaxNode } from '@lezer/common';

import { type CodeMirrorCompletionContext } from '@grafana/ui/unstable';

const SQL_STATEMENT_NODE_NAME = 'Statement';
const SQL_COMPOSITE_IDENTIFIER_NODE_NAME = 'CompositeIdentifier';
const SQL_IDENTIFIER_NODE_NAME = 'Identifier';
const SQL_KEYWORD_NODE_NAME = 'Keyword';
const SQL_PUNCTUATION_NODE_NAME = 'Punctuation';

const SQL_FROM_KEYWORD = 'FROM';
const SQL_JOIN_KEYWORD = 'JOIN';
const SQL_AS_KEYWORD = 'AS';
const SQL_ON_KEYWORD = 'ON';
const SQL_STATEMENT_TERMINATOR = ';';

const SQL_FROM_SECTION_END_KEYWORDS = new Set([
  'WHERE',
  'GROUP',
  'ORDER',
  'HAVING',
  'LIMIT',
  'UNION',
  'EXCEPT',
  'INTERSECT',
]);
const SQL_JOIN_MODIFIER_KEYWORDS = new Set(['CROSS', 'FULL', 'INNER', 'LEFT', 'NATURAL', 'OUTER', 'RIGHT']);
const SQL_CLAUSE_BLOCKING_KEYWORDS = new Set([SQL_FROM_KEYWORD, SQL_JOIN_KEYWORD, SQL_AS_KEYWORD, SQL_ON_KEYWORD]);

interface QualifiedColumnContext {
  from: number;
  table: string;
}

interface TableRef {
  table: string;
  alias?: string;
}

export interface CompletionWord {
  from: number;
  to: number;
}

export type SqlCompletionSituation =
  | { type: 'qualified-column'; from: number; table: string }
  | { type: 'table'; from: number }
  | { type: 'clause'; from: number }
  | { type: 'general'; from: number; tables: string[] }
  | { type: 'none' };

/**
 * Turns the SQL parser's shallow token stream into the editor situation used to choose completions.
 */
export function getSqlCompletionSituation(
  context: CodeMirrorCompletionContext,
  word: CompletionWord | null
): SqlCompletionSituation {
  const statement = getStatementAtCursor(context);
  const tableRefs = statement ? getTableRefs(context, statement) : [];
  const qualifiedColumnContext = statement ? getQualifiedColumnContext(context, statement) : undefined;

  if (qualifiedColumnContext) {
    return {
      type: 'qualified-column',
      from: qualifiedColumnContext.from,
      table: resolveQualifiedTable(tableRefs, qualifiedColumnContext.table),
    };
  }

  const completionFrom = word?.from ?? context.pos;

  if (statement && isAfterStatementTerminator(context, statement, completionFrom)) {
    return { type: 'none' };
  }

  if (statement && isTableCompletionPosition(context, statement, completionFrom)) {
    return { type: 'table', from: completionFrom };
  }

  if (statement && isClauseCompletionPosition(context, statement, completionFrom, tableRefs)) {
    return { type: 'clause', from: completionFrom };
  }

  if (!word || (word.from === word.to && !context.explicit)) {
    return { type: 'none' };
  }

  return {
    type: 'general',
    from: word.from,
    tables: getUniqueTables(tableRefs),
  };
}

function getStatementAtCursor(context: CodeMirrorCompletionContext): SyntaxNode | null {
  const tree = syntaxTree(context.state);
  const pos = Math.min(context.pos, context.state.doc.length);
  let node: SyntaxNode | null = tree.resolveInner(pos, -1);

  while (node) {
    if (node.name === SQL_STATEMENT_NODE_NAME) {
      return node;
    }

    node = node.parent;
  }

  return getStatementAtOrBefore(tree.topNode, pos);
}

function getStatementAtOrBefore(node: SyntaxNode, pos: number): SyntaxNode | null {
  let candidate: SyntaxNode | null = null;

  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name !== SQL_STATEMENT_NODE_NAME || child.from > pos) {
      continue;
    }

    if (child.to >= pos) {
      return child;
    }

    candidate = child;
  }

  return candidate;
}

function getQualifiedColumnContext(
  context: CodeMirrorCompletionContext,
  statement: SyntaxNode
): QualifiedColumnContext | undefined {
  const compositeIdentifier = getCompositeIdentifierAtCursor(context, statement);

  if (!compositeIdentifier) {
    return undefined;
  }

  const textBeforeCursor = context.state.doc.sliceString(compositeIdentifier.from, context.pos);
  const dotIndex = textBeforeCursor.lastIndexOf('.');

  if (dotIndex === -1) {
    return undefined;
  }

  const table = textBeforeCursor.slice(0, dotIndex).trim();

  if (!table) {
    return undefined;
  }

  return {
    table,
    from: compositeIdentifier.from + dotIndex + 1,
  };
}

function getCompositeIdentifierAtCursor(
  context: CodeMirrorCompletionContext,
  statement: SyntaxNode
): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(context.state).resolveInner(context.pos, -1);

  while (node && node !== statement) {
    if (node.name === SQL_COMPOSITE_IDENTIFIER_NODE_NAME) {
      return node;
    }

    node = node.parent;
  }

  return null;
}

/**
 * Extracts table refs and aliases from FROM/JOIN tokens in the parsed statement.
 */
function getTableRefs(context: CodeMirrorCompletionContext, statement: SyntaxNode): TableRef[] {
  const children = getStatementChildren(statement);
  const tableRefs: TableRef[] = [];

  for (let index = 0; index < children.length; index++) {
    const keyword = getKeywordText(context, children[index]);

    if (keyword === SQL_FROM_KEYWORD) {
      index = readFromTableRefs(context, children, index + 1, tableRefs);
      continue;
    }

    if (keyword === SQL_JOIN_KEYWORD) {
      const result = readTableRefAt(context, children, index + 1);

      if (result) {
        tableRefs.push(result.tableRef);
        index = result.nextIndex - 1;
      }
    }
  }

  return tableRefs;
}

function readFromTableRefs(
  context: CodeMirrorCompletionContext,
  children: SyntaxNode[],
  startIndex: number,
  tableRefs: TableRef[]
): number {
  let index = startIndex;

  while (index < children.length) {
    const keyword = getKeywordText(context, children[index]);

    if (keyword === SQL_JOIN_KEYWORD || SQL_JOIN_MODIFIER_KEYWORDS.has(keyword) || isFromSectionEndKeyword(keyword)) {
      return index - 1;
    }

    if (isComma(context, children[index])) {
      index++;
      continue;
    }

    const result = readTableRefAt(context, children, index);

    if (result) {
      tableRefs.push(result.tableRef);
      index = result.nextIndex;
      continue;
    }

    index++;
  }

  return index;
}

function readTableRefAt(
  context: CodeMirrorCompletionContext,
  children: SyntaxNode[],
  index: number
): { tableRef: TableRef; nextIndex: number } | undefined {
  const tableNode = children[index];

  if (!tableNode || !isIdentifierLike(tableNode)) {
    return undefined;
  }

  const table = getNodeText(context, tableNode).trim();
  const aliasResult = readAliasAt(context, children, index + 1);

  return {
    tableRef: aliasResult.alias ? { table, alias: aliasResult.alias } : { table },
    nextIndex: aliasResult.nextIndex,
  };
}

function readAliasAt(
  context: CodeMirrorCompletionContext,
  children: SyntaxNode[],
  index: number
): { alias?: string; nextIndex: number } {
  const maybeAsKeyword = children[index];
  const aliasIndex = getKeywordText(context, maybeAsKeyword) === SQL_AS_KEYWORD ? index + 1 : index;
  const aliasNode = children[aliasIndex];

  if (!aliasNode || aliasNode.name !== SQL_IDENTIFIER_NODE_NAME) {
    return { nextIndex: aliasIndex };
  }

  return {
    alias: getNodeText(context, aliasNode).trim(),
    nextIndex: aliasIndex + 1,
  };
}

function resolveQualifiedTable(tableRefs: TableRef[], tableOrAlias: string): string {
  // Prefer exact table refs so aliases cannot shadow real table identifiers.
  const exactTableRef = tableRefs.find(({ table }) => table === tableOrAlias);

  if (exactTableRef) {
    return exactTableRef.table;
  }

  const aliasedTableRef = tableRefs.find(({ alias }) => alias === tableOrAlias);
  return aliasedTableRef?.table ?? tableOrAlias;
}

function getUniqueTables(tableRefs: TableRef[]): string[] {
  return [...new Set(tableRefs.map(({ table }) => table))];
}

function isTableCompletionPosition(
  context: CodeMirrorCompletionContext,
  statement: SyntaxNode,
  completionFrom: number
): boolean {
  const previousNode = getPreviousStatementChild(statement, completionFrom);
  const previousKeyword = getKeywordText(context, previousNode);

  return (
    previousKeyword === SQL_FROM_KEYWORD ||
    previousKeyword === SQL_JOIN_KEYWORD ||
    (isComma(context, previousNode) && isInFromSection(context, statement, completionFrom))
  );
}

function isClauseCompletionPosition(
  context: CodeMirrorCompletionContext,
  statement: SyntaxNode,
  completionFrom: number,
  tableRefs: TableRef[]
): boolean {
  if (tableRefs.length === 0 || !isInFromSection(context, statement, completionFrom)) {
    return false;
  }

  const previousNode = getPreviousStatementChild(statement, completionFrom);
  const previousKeyword = getKeywordText(context, previousNode);

  if (
    SQL_CLAUSE_BLOCKING_KEYWORDS.has(previousKeyword) ||
    isComma(context, previousNode) ||
    isStatementTerminator(context, previousNode)
  ) {
    return false;
  }

  return true;
}

function isAfterStatementTerminator(context: CodeMirrorCompletionContext, statement: SyntaxNode, pos: number): boolean {
  return isStatementTerminator(context, getPreviousStatementChild(statement, pos));
}

function isInFromSection(context: CodeMirrorCompletionContext, statement: SyntaxNode, pos: number): boolean {
  let hasFrom = false;

  for (const child of getStatementChildren(statement)) {
    if (child.from >= pos) {
      break;
    }

    const keyword = getKeywordText(context, child);

    if (keyword === SQL_FROM_KEYWORD) {
      hasFrom = true;
      continue;
    }

    if (hasFrom && isFromSectionEndKeyword(keyword)) {
      return false;
    }
  }

  return hasFrom;
}

function isFromSectionEndKeyword(keyword: string): boolean {
  return SQL_FROM_SECTION_END_KEYWORDS.has(keyword);
}

function getPreviousStatementChild(statement: SyntaxNode, pos: number): SyntaxNode | undefined {
  const children = getStatementChildren(statement);
  let previous: SyntaxNode | undefined;

  for (const child of children) {
    if (child.to > pos) {
      break;
    }

    previous = child;
  }

  return previous;
}

function getStatementChildren(statement: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];

  for (let child = statement.firstChild; child; child = child.nextSibling) {
    children.push(child);
  }

  return children;
}

function isIdentifierLike(node: SyntaxNode | undefined): node is SyntaxNode {
  return node?.name === SQL_IDENTIFIER_NODE_NAME || node?.name === SQL_COMPOSITE_IDENTIFIER_NODE_NAME;
}

function isComma(context: CodeMirrorCompletionContext, node: SyntaxNode | undefined): boolean {
  return node?.name === SQL_PUNCTUATION_NODE_NAME && getNodeText(context, node) === ',';
}

function isStatementTerminator(context: CodeMirrorCompletionContext, node: SyntaxNode | undefined): boolean {
  return node ? getNodeText(context, node) === SQL_STATEMENT_TERMINATOR : false;
}

function getKeywordText(context: CodeMirrorCompletionContext, node: SyntaxNode | undefined): string {
  return node?.name === SQL_KEYWORD_NODE_NAME ? getNodeText(context, node).toUpperCase() : '';
}

function getNodeText(context: CodeMirrorCompletionContext, node: SyntaxNode): string {
  return context.state.doc.sliceString(node.from, node.to);
}
