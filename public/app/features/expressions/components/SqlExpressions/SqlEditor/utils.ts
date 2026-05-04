import { type CodeMirrorCompletionSource } from '@grafana/ui/unstable';

import { getSqlCompletionSituation } from './completionSituation';

export type SqlCompletionKind = 'clause' | 'column' | 'function' | 'keyword' | 'table';

const SQL_WORD_PATTERN = /[\w$]*/;
const SQL_COMPLETION_VALID_FOR_PATTERN = /^[\w$]*$/;

// General completions cover expression keywords plus SELECT/FROM, which are needed before clause completions apply.
const DEFAULT_SQL_KEYWORDS: SqlCompletionItem[] = [
  'SELECT',
  'FROM',
  'AS',
  'DISTINCT',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'AND',
  'OR',
  'NOT',
  'NULL',
  'IS',
  'IN',
  'BETWEEN',
  'LIKE',
  'EXISTS',
  'ASC',
  'DESC',
  'CAST',
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
      const clauses = resolveClauses(completionProvider);

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
    const functions = await resolveFunctions(completionProvider);

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
  try {
    return (await completionProvider.tables?.()) ?? [];
  } catch {
    return [];
  }
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

function resolveClauses(completionProvider: SqlCompletionProvider): SqlCompletionItem[] {
  try {
    return completionProvider.clauses?.() ?? [];
  } catch {
    return [];
  }
}

async function resolveFunctions(completionProvider: SqlCompletionProvider): Promise<SqlCompletionItem[]> {
  try {
    return (await completionProvider.functions?.()) ?? [];
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
