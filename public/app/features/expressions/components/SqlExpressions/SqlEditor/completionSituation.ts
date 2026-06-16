import { syntaxTree } from '@codemirror/language';
import { type SyntaxNode } from '@lezer/common';

import { type CodeMirrorCompletionContext } from '@grafana/ui/unstable';

const SQL_STATEMENT_NODE_NAME = 'Statement';
const SQL_COMPOSITE_IDENTIFIER_NODE_NAME = 'CompositeIdentifier';
const SQL_IDENTIFIER_NODE_NAME = 'Identifier';
const SQL_KEYWORD_NODE_NAME = 'Keyword';
const SQL_PUNCTUATION_NODE_NAME = 'Punctuation';

const SQL_SELECT_KEYWORD = 'SELECT';
const SQL_FROM_KEYWORD = 'FROM';
const SQL_JOIN_KEYWORD = 'JOIN';
const SQL_AS_KEYWORD = 'AS';
const SQL_STATEMENT_TERMINATOR = ';';

const SQL_SET_OPERATOR_KEYWORDS = new Set(['EXCEPT', 'INTERSECT', 'UNION']);
const SQL_FROM_SECTION_END_KEYWORDS = new Set([
  'WHERE',
  'GROUP',
  'ORDER',
  'HAVING',
  'LIMIT',
  ...SQL_SET_OPERATOR_KEYWORDS,
]);
const SQL_JOIN_MODIFIER_KEYWORDS = new Set(['CROSS', 'FULL', 'INNER', 'LEFT', 'NATURAL', 'OUTER', 'RIGHT']);

interface QualifiedColumnContext {
  from: number;
  table: string;
}

interface TableRef {
  table: string;
  alias?: string;
}

interface ResolvedQualifiedTable {
  table: string;
  // Tracks whether the qualifier came from FROM/JOIN scope so callers do not need a separate table provider.
  isTableRef: boolean;
}

export interface CompletionWord {
  from: number;
  to: number;
}

export type SqlCompletionSituation =
  | { type: 'qualified-column'; from: number; table: string; isTableRef: boolean }
  | { type: 'table'; from: number }
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
  const completionFrom = word?.from ?? context.pos;
  const statementChildren = statement ? getCurrentSelectSegmentChildren(context, statement, context.pos) : [];
  const tableRefs = getTableRefs(context, statementChildren);
  const qualifiedColumnContext = statement ? getQualifiedColumnContext(context, statement) : undefined;

  if (qualifiedColumnContext) {
    const qualifiedTable = resolveQualifiedTable(tableRefs, qualifiedColumnContext.table);

    return {
      type: 'qualified-column',
      from: qualifiedColumnContext.from,
      table: qualifiedTable.table,
      isTableRef: qualifiedTable.isTableRef,
    };
  }

  if (statement && isAfterStatementTerminator(context, statementChildren, completionFrom)) {
    return { type: 'none' };
  }

  if (statement && isTableCompletionPosition(context, statementChildren, completionFrom)) {
    return { type: 'table', from: completionFrom };
  }

  // Let whitespace-triggered completions in the SELECT list use tables declared later in FROM.
  if (statement && tableRefs.length > 0 && isSelectListCompletionPosition(context, statementChildren, completionFrom)) {
    return {
      type: 'general',
      from: completionFrom,
      tables: getUniqueTables(tableRefs),
    };
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

function getCurrentSelectSegmentChildren(
  context: CodeMirrorCompletionContext,
  statement: SyntaxNode,
  pos: number
): SyntaxNode[] {
  const children = getStatementChildren(statement);
  let segmentStart = 0;
  let segmentEnd = children.length;

  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    const keyword = getKeywordText(context, child);

    if (!SQL_SET_OPERATOR_KEYWORDS.has(keyword)) {
      continue;
    }

    if (child.to <= pos) {
      segmentStart = index + 1;
      continue;
    }

    if (child.from >= pos) {
      segmentEnd = index;
      break;
    }
  }

  return children.slice(segmentStart, segmentEnd);
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
function getTableRefs(context: CodeMirrorCompletionContext, children: SyntaxNode[]): TableRef[] {
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

function resolveQualifiedTable(tableRefs: TableRef[], tableOrAlias: string): ResolvedQualifiedTable {
  // Prefer exact table refs so aliases cannot shadow real table identifiers.
  const exactTableRef = tableRefs.find(({ table }) => isSameIdentifier(table, tableOrAlias));

  if (exactTableRef) {
    return { table: exactTableRef.table, isTableRef: true };
  }

  const aliasedTableRef = tableRefs.find(({ alias }) => isSameIdentifier(alias, tableOrAlias));
  return aliasedTableRef
    ? { table: aliasedTableRef.table, isTableRef: true }
    : { table: tableOrAlias, isTableRef: false };
}

function isSameIdentifier(identifier: string | undefined, otherIdentifier: string): boolean {
  // This parser path only handles unquoted identifiers, which SQL treats as case-insensitive.
  return identifier?.toLowerCase() === otherIdentifier.toLowerCase();
}

function getUniqueTables(tableRefs: TableRef[]): string[] {
  return [...new Set(tableRefs.map(({ table }) => table))];
}

function isTableCompletionPosition(
  context: CodeMirrorCompletionContext,
  statementChildren: SyntaxNode[],
  completionFrom: number
): boolean {
  const previousNode = getPreviousStatementChild(statementChildren, completionFrom);
  const previousKeyword = getKeywordText(context, previousNode);

  return (
    previousKeyword === SQL_FROM_KEYWORD ||
    previousKeyword === SQL_JOIN_KEYWORD ||
    (isComma(context, previousNode) && isInFromSection(context, statementChildren, completionFrom))
  );
}

/**
 * Detects cursor positions before FROM where unqualified SELECT-list columns are useful.
 */
function isSelectListCompletionPosition(
  context: CodeMirrorCompletionContext,
  statementChildren: SyntaxNode[],
  completionFrom: number
): boolean {
  let hasSelectBeforeCursor = false;

  for (const child of statementChildren) {
    const keyword = getKeywordText(context, child);

    if (child.from >= completionFrom) {
      return hasSelectBeforeCursor;
    }

    if (keyword === SQL_SELECT_KEYWORD) {
      hasSelectBeforeCursor = true;
      continue;
    }

    if (keyword === SQL_FROM_KEYWORD) {
      return false;
    }
  }

  return hasSelectBeforeCursor;
}

function isAfterStatementTerminator(
  context: CodeMirrorCompletionContext,
  statementChildren: SyntaxNode[],
  pos: number
): boolean {
  return isStatementTerminator(context, getPreviousStatementChild(statementChildren, pos));
}

function isInFromSection(context: CodeMirrorCompletionContext, statementChildren: SyntaxNode[], pos: number): boolean {
  let hasFrom = false;

  for (const child of statementChildren) {
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

function getPreviousStatementChild(statementChildren: SyntaxNode[], pos: number): SyntaxNode | undefined {
  let previous: SyntaxNode | undefined;

  for (const child of statementChildren) {
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
