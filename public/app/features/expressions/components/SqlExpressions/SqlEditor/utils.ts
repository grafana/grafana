import { type CodeMirrorCompletionSource } from '@grafana/ui/unstable';

export type SqlCompletionKind = 'clause' | 'column' | 'function' | 'keyword' | 'table';

const SQL_WORD_PATTERN = /[\w$]*/;
const SQL_COMPLETION_VALID_FOR_PATTERN = /^[\w$]*$/;
const SQL_CURRENT_WORD_PATTERN = /[A-Za-z_][\w$]*$/;
const SQL_QUALIFIED_COLUMN_PATTERN = /([A-Za-z_][\w$]*)\.([\w$]*)$/;
// Stop table parsing at clauses that end the FROM/JOIN section of the query.
const SQL_CLAUSE_BOUNDARY_PATTERN = /\b(?:where|group\s+by|order\s+by|having|limit|union|except|intersect)\b/i;
const SQL_FROM_TABLE_LIST_PATTERN = /\bfrom\s+([\s\S]*?)(?=\bjoin\b|$)/gi;
const SQL_JOIN_TABLE_PATTERN = /\bjoin\s+([A-Za-z_][\w$]*)(?:\s+(?:as\s+)?([A-Za-z_][\w$]*))?/gi;
const SQL_TABLE_REF_PATTERN = /^([A-Za-z_][\w$]*)(?:\s+(?:as\s+)?([A-Za-z_][\w$]*))?/i;
const SQL_TABLE_COMPLETION_START_PATTERN = /\b(?:from|join)$/i;
const SQL_COMMA_TABLE_COMPLETION_PATTERN = /\bfrom\s+[\w\s,$]+,$/i;
const SQL_FROM_TABLE_PATTERN = /\bfrom\s+[A-Za-z_][\w$]*/i;
// The alias parser is permissive, so these SQL words should not be treated as aliases.
const SQL_ALIAS_STOP_WORDS = new Set([
  'as',
  'cross',
  'full',
  'group',
  'having',
  'inner',
  'join',
  'left',
  'limit',
  'natural',
  'on',
  'order',
  'outer',
  'right',
  'where',
]);
// Include common SQL keywords in the generic completion set so accepting a completion does not prefer niche functions.
const DEFAULT_SQL_KEYWORDS: SqlCompletionItem[] = [
  'SELECT',
  'FROM',
  'WHERE',
  'JOIN',
  'LEFT JOIN',
  'INNER JOIN',
  'GROUP BY',
  'ORDER BY',
  'HAVING',
  'LIMIT',
].map((label) => ({ label, kind: 'keyword', boost: 50 }));

export interface SqlCompletionItem {
  label: string;
  insertText?: string;
  detail?: string;
  documentation?: string;
  kind?: SqlCompletionKind;
  boost?: number;
}

export interface SqlCompletionContext {
  table?: string;
}

export interface SqlCompletionProvider {
  tables?: () => Promise<SqlCompletionItem[]> | SqlCompletionItem[];
  columns?: (context: SqlCompletionContext) => Promise<SqlCompletionItem[]> | SqlCompletionItem[];
  clauses?: () => SqlCompletionItem[];
  functions?: () => Promise<SqlCompletionItem[]> | SqlCompletionItem[];
}

export interface QualifiedColumnContext {
  from: number;
  table: string;
}

interface TableRef {
  table: string;
  alias?: string;
}

/**
 * Builds the CodeMirror completion source and selects the suggestion set from the cursor context.
 */
export function getSqlCompletionSource(completionProvider: SqlCompletionProvider): CodeMirrorCompletionSource {
  return async (context) => {
    const word = context.matchBefore(SQL_WORD_PATTERN);
    const sqlBeforeCursor = context.state.doc.sliceString(0, context.pos);
    const sql = context.state.doc.toString();
    const qualifiedColumnContext = getQualifiedColumnContext(sqlBeforeCursor);

    if (qualifiedColumnContext) {
      const tables = await resolveTables(completionProvider);
      const table = resolveQualifiedTable(sql, qualifiedColumnContext.table);
      const isKnownTable = tables.some((t) => getCompletionInsertText(t) === table);

      if (!isKnownTable) {
        return null;
      }

      const columns = await resolveColumns(completionProvider, { table });

      return context.aborted
        ? null
        : {
            from: qualifiedColumnContext.from,
            options: columns.map((item) => toCodeMirrorCompletion(item, 'column')),
            validFor: SQL_COMPLETION_VALID_FOR_PATTERN,
          };
    }

    if (isTableCompletionPosition(sqlBeforeCursor)) {
      const tables = await resolveTables(completionProvider);

      return context.aborted
        ? null
        : {
            from: word?.from ?? context.pos,
            options: tables.map((item) => toCodeMirrorCompletion(item, 'table')),
            validFor: SQL_COMPLETION_VALID_FOR_PATTERN,
          };
    }

    if (isClauseCompletionPosition(sqlBeforeCursor)) {
      const clauses = completionProvider.clauses?.() ?? [];

      return {
        from: word?.from ?? context.pos,
        options: clauses.map((item) => toCodeMirrorCompletion(item, 'clause')),
        validFor: SQL_COMPLETION_VALID_FOR_PATTERN,
      };
    }

    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const keywords = DEFAULT_SQL_KEYWORDS;
    const columns = await resolveColumnsForTables(completionProvider, getFromTables(sql));
    const functions = (await completionProvider.functions?.()) ?? [];

    return context.aborted
      ? null
      : {
          from: word.from,
          options: [
            ...columns.map((item) => toCodeMirrorCompletion(item, 'column')),
            ...keywords.map((item) => toCodeMirrorCompletion(item, 'keyword')),
            ...functions.map((item) => toCodeMirrorCompletion(item, 'function')),
          ],
          validFor: SQL_COMPLETION_VALID_FOR_PATTERN,
        };
  };
}

function toCodeMirrorCompletion(item: SqlCompletionItem, fallbackKind: SqlCompletionKind) {
  const kind = item.kind ?? fallbackKind;

  return {
    label: item.label,
    apply: item.insertText,
    detail: item.detail,
    info: item.documentation,
    type: getCompletionType(kind),
    section: getCompletionSection(kind),
    boost: item.boost,
  };
}

function getCompletionType(kind: SqlCompletionKind): string {
  switch (kind) {
    case 'clause':
      return 'keyword';
    case 'column':
      return 'property';
    case 'function':
      return 'function';
    case 'keyword':
      return 'keyword';
    case 'table':
      return 'variable';
  }
}

function getCompletionSection(kind: SqlCompletionKind) {
  switch (kind) {
    case 'clause':
      return { name: 'Clauses', rank: 2 };
    case 'column':
      return { name: 'Columns', rank: 1 };
    case 'function':
      return { name: 'Functions', rank: 3 };
    case 'keyword':
      return { name: 'Keywords', rank: 2 };
    case 'table':
      return { name: 'Tables', rank: 0 };
  }
}

async function resolveTables(completionProvider: SqlCompletionProvider): Promise<SqlCompletionItem[]> {
  return (await completionProvider.tables?.()) ?? [];
}

async function resolveColumns(
  completionProvider: SqlCompletionProvider,
  completionContext: SqlCompletionContext
): Promise<SqlCompletionItem[]> {
  try {
    return (await completionProvider.columns?.(completionContext)) ?? [];
  } catch {
    return [];
  }
}

async function resolveColumnsForTables(
  completionProvider: SqlCompletionProvider,
  tables: string[]
): Promise<SqlCompletionItem[]> {
  // Load columns concurrently because each table lookup is independent.
  const columns = await Promise.all(tables.map((table) => resolveColumns(completionProvider, { table })));
  return columns.flat();
}

function getCompletionInsertText(item: SqlCompletionItem): string {
  return item.insertText ?? item.label;
}

/**
 * Finds completions after a qualified reference like `A.` or `alias.columnPrefix`.
 */
export function getQualifiedColumnContext(sqlBeforeCursor: string): QualifiedColumnContext | undefined {
  const match = sqlBeforeCursor.match(SQL_QUALIFIED_COLUMN_PATTERN);

  if (!match) {
    return undefined;
  }

  return {
    table: match[1],
    from: sqlBeforeCursor.length - match[2].length,
  };
}

/**
 * Returns unique table identifiers from FROM/JOIN clauses, ignoring aliases.
 */
export function getFromTables(sql: string): string[] {
  return [...new Set(getTableRefs(sql).map(({ table }) => table))];
}

/**
 * Extracts table refs and aliases from the query before filtering/grouping clauses begin.
 */
function getTableRefs(sql: string): TableRef[] {
  const queryBeforeClause = getQueryBeforeClause(sql);
  const tableRefs: TableRef[] = [];

  for (const fromMatch of queryBeforeClause.matchAll(SQL_FROM_TABLE_LIST_PATTERN)) {
    tableRefs.push(...getTableRefsFromList(fromMatch[1]));
  }

  for (const joinMatch of queryBeforeClause.matchAll(SQL_JOIN_TABLE_PATTERN)) {
    tableRefs.push(toTableRef(joinMatch[1], joinMatch[2]));
  }

  return tableRefs;
}

function getQueryBeforeClause(sql: string): string {
  return sql.split(SQL_CLAUSE_BOUNDARY_PATTERN)[0];
}

function getTableRefsFromList(tableList: string): TableRef[] {
  return tableList
    .split(',')
    .map((table) => {
      const match = table.trim().match(SQL_TABLE_REF_PATTERN);
      return match ? toTableRef(match[1], match[2]) : undefined;
    })
    .filter((tableRef): tableRef is TableRef => Boolean(tableRef));
}

/**
 * Normalizes a parsed table/alias pair and drops aliases that are really SQL syntax.
 */
function toTableRef(table: string, alias?: string): TableRef {
  if (!alias || SQL_ALIAS_STOP_WORDS.has(alias.toLowerCase())) {
    return { table };
  }

  return { table, alias };
}

function resolveQualifiedTable(sql: string, tableOrAlias: string): string {
  const tableRefs = getTableRefs(sql);
  // Prefer exact table refs so aliases cannot shadow real table identifiers.
  const exactTableRef = tableRefs.find(({ table }) => table === tableOrAlias);

  if (exactTableRef) {
    return exactTableRef.table;
  }

  const aliasedTableRef = tableRefs.find(({ alias }) => alias === tableOrAlias);
  return aliasedTableRef?.table ?? tableOrAlias;
}

/**
 * Detects positions where the next completion should be a table reference.
 */
export function isTableCompletionPosition(sqlBeforeCursor: string): boolean {
  const textBeforeCurrentWord = getTextBeforeCurrentWord(sqlBeforeCursor);

  return (
    SQL_TABLE_COMPLETION_START_PATTERN.test(textBeforeCurrentWord) ||
    SQL_COMMA_TABLE_COMPLETION_PATTERN.test(textBeforeCurrentWord)
  );
}

/**
 * Detects positions after a table reference where SQL clauses like WHERE or GROUP BY are useful.
 */
export function isClauseCompletionPosition(sqlBeforeCursor: string): boolean {
  const textBeforeCurrentWord = getTextBeforeCurrentWord(sqlBeforeCursor);

  if (!SQL_FROM_TABLE_PATTERN.test(textBeforeCurrentWord)) {
    return false;
  }

  if (SQL_TABLE_COMPLETION_START_PATTERN.test(textBeforeCurrentWord) || textBeforeCurrentWord.endsWith(',')) {
    return false;
  }

  const afterLastFrom = textBeforeCurrentWord.slice(textBeforeCurrentWord.toLowerCase().lastIndexOf('from') + 4);
  return !SQL_CLAUSE_BOUNDARY_PATTERN.test(afterLastFrom);
}

function getTextBeforeCurrentWord(sqlBeforeCursor: string): string {
  return sqlBeforeCursor.replace(SQL_CURRENT_WORD_PATTERN, '').trimEnd();
}
