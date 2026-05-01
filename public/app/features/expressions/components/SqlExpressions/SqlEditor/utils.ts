import { type CodeMirrorCompletionSource } from '@grafana/ui/unstable';

import { getSqlCompletionSituation } from './completionSituation';

export type SqlCompletionKind = 'clause' | 'column' | 'function' | 'keyword' | 'table';

const SQL_WORD_PATTERN = /[\w$]*/;
const SQL_COMPLETION_VALID_FOR_PATTERN = /^[\w$]*$/;

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

/**
 * Builds the CodeMirror completion source and selects the suggestion set from the cursor context.
 */
export function getSqlCompletionSource(completionProvider: SqlCompletionProvider): CodeMirrorCompletionSource {
  return async (context) => {
    const word = context.matchBefore(SQL_WORD_PATTERN);
    const situation = getSqlCompletionSituation(context, word);

    if (situation.type === 'qualified-column') {
      const tables = await resolveTables(completionProvider);
      const isKnownTable = tables.some((t) => getCompletionInsertText(t) === situation.table);

      if (!isKnownTable) {
        return null;
      }

      const columns = await resolveColumns(completionProvider, { table: situation.table });

      return context.aborted
        ? null
        : {
            from: situation.from,
            options: columns.map((item) => toCodeMirrorCompletion(item, 'column')),
            validFor: SQL_COMPLETION_VALID_FOR_PATTERN,
          };
    }

    if (situation.type === 'table') {
      const tables = await resolveTables(completionProvider);

      return context.aborted
        ? null
        : {
            from: situation.from,
            options: tables.map((item) => toCodeMirrorCompletion(item, 'table')),
            validFor: SQL_COMPLETION_VALID_FOR_PATTERN,
          };
    }

    if (situation.type === 'clause') {
      const clauses = completionProvider.clauses?.() ?? [];

      return {
        from: situation.from,
        options: clauses.map((item) => toCodeMirrorCompletion(item, 'clause')),
        validFor: SQL_COMPLETION_VALID_FOR_PATTERN,
      };
    }

    if (situation.type === 'none') {
      return null;
    }

    const columns = await resolveColumnsForTables(completionProvider, situation.tables);
    const functions = (await completionProvider.functions?.()) ?? [];

    return context.aborted
      ? null
      : {
          from: situation.from,
          options: [
            ...columns.map((item) => toCodeMirrorCompletion(item, 'column')),
            ...DEFAULT_SQL_KEYWORDS.map((item) => toCodeMirrorCompletion(item, 'keyword')),
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
