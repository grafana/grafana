import { type CodeMirrorCompletionSource } from '@grafana/ui/unstable';

export type SqlCompletionKind = 'clause' | 'column' | 'function' | 'keyword' | 'table';

const SQL_CLAUSE_BOUNDARY_PATTERN = /\b(?:where|group\s+by|order\s+by|having|limit|union|except|intersect)\b/i;

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

export function getSqlCompletionSource(completionProvider: SqlCompletionProvider): CodeMirrorCompletionSource {
  return async (context) => {
    const word = context.matchBefore(/[\w$]*/);
    const sqlBeforeCursor = context.state.doc.sliceString(0, context.pos);
    const sql = context.state.doc.toString();
    const qualifiedColumnContext = getQualifiedColumnContext(sqlBeforeCursor);

    if (qualifiedColumnContext) {
      const tables = await resolveTables(completionProvider);
      const isKnownTable = tables.some((t) => getCompletionInsertText(t) === qualifiedColumnContext.table);

      if (!isKnownTable) {
        return null;
      }

      const columns = await resolveColumns(completionProvider, { table: qualifiedColumnContext.table });

      return context.aborted
        ? null
        : {
            from: qualifiedColumnContext.from,
            options: columns.map((item) => toCodeMirrorCompletion(item, 'column')),
            validFor: /^[\w$]*$/,
          };
    }

    if (isTableCompletionPosition(sqlBeforeCursor)) {
      const tables = await resolveTables(completionProvider);

      return context.aborted
        ? null
        : {
            from: word?.from ?? context.pos,
            options: tables.map((item) => toCodeMirrorCompletion(item, 'table')),
            validFor: /^[\w$]*$/,
          };
    }

    if (isClauseCompletionPosition(sqlBeforeCursor)) {
      const clauses = completionProvider.clauses?.() ?? [];

      return {
        from: word?.from ?? context.pos,
        options: clauses.map((item) => toCodeMirrorCompletion(item, 'clause')),
        validFor: /^[\w$]*$/,
      };
    }

    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const columns = await resolveColumnsForTables(completionProvider, getFromTables(sql));
    const functions = (await completionProvider.functions?.()) ?? [];

    return context.aborted
      ? null
      : {
          from: word.from,
          options: [
            ...columns.map((item) => toCodeMirrorCompletion(item, 'column')),
            ...functions.map((item) => toCodeMirrorCompletion(item, 'function')),
          ],
          validFor: /^[\w$]*$/,
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
      return { name: 'Keywords', rank: 4 };
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
  const columns: SqlCompletionItem[] = [];

  for (const table of tables) {
    columns.push(...(await resolveColumns(completionProvider, { table })));
  }

  return columns;
}

function getCompletionInsertText(item: SqlCompletionItem): string {
  return item.insertText ?? item.label;
}

export function getQualifiedColumnContext(sqlBeforeCursor: string): QualifiedColumnContext | undefined {
  const match = sqlBeforeCursor.match(/([A-Za-z_][\w$]*)\.([\w$]*)$/);

  if (!match) {
    return undefined;
  }

  return {
    table: match[1],
    from: sqlBeforeCursor.length - match[2].length,
  };
}

export function getFromTables(sql: string): string[] {
  const queryBeforeClause = getQueryBeforeClause(sql);
  const tables: string[] = [];

  for (const fromMatch of queryBeforeClause.matchAll(/\bfrom\s+([\s\S]*?)(?=\bjoin\b|$)/gi)) {
    tables.push(...getTableRefsFromList(fromMatch[1]));
  }

  for (const joinMatch of queryBeforeClause.matchAll(/\bjoin\s+([A-Za-z_][\w$]*)/gi)) {
    tables.push(joinMatch[1]);
  }

  return [...new Set(tables)];
}

function getQueryBeforeClause(sql: string): string {
  return sql.split(SQL_CLAUSE_BOUNDARY_PATTERN)[0];
}

function getTableRefsFromList(tableList: string): string[] {
  return tableList
    .split(',')
    .map((table) => table.trim().match(/^[A-Za-z_][\w$]*/)?.[0])
    .filter((table): table is string => Boolean(table));
}

export function isTableCompletionPosition(sqlBeforeCursor: string): boolean {
  const textBeforeCurrentWord = sqlBeforeCursor.replace(/[A-Za-z_][\w$]*$/, '').trimEnd();

  return /\b(?:from|join)$/i.test(textBeforeCurrentWord) || /\bfrom\s+[\w\s,$]+,$/i.test(textBeforeCurrentWord);
}

export function isClauseCompletionPosition(sqlBeforeCursor: string): boolean {
  const textBeforeCurrentWord = sqlBeforeCursor.replace(/[A-Za-z_][\w$]*$/, '').trimEnd();

  if (!/\bfrom\s+[A-Za-z_][\w$]*/i.test(textBeforeCurrentWord)) {
    return false;
  }

  if (/\b(?:from|join)$/i.test(textBeforeCurrentWord) || textBeforeCurrentWord.endsWith(',')) {
    return false;
  }

  const afterLastFrom = textBeforeCurrentWord.slice(textBeforeCurrentWord.toLowerCase().lastIndexOf('from') + 4);
  return !SQL_CLAUSE_BOUNDARY_PATTERN.test(afterLastFrom);
}
