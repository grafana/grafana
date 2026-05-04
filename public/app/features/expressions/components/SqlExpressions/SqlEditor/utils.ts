import {
  type CodeMirrorCompletion,
  type CodeMirrorCompletionContext,
  type CodeMirrorCompletionResult,
  type CodeMirrorCompletionSource,
} from '@grafana/ui/unstable';

import { getSqlCompletionSituation } from './completionSituation';

export type SqlCompletionKind = 'column' | 'function' | 'keyword' | 'table';

const SQL_WORD_PATTERN = /[\w$]*/;
const SQL_COMPLETION_VALID_FOR_PATTERN = /^[\w$]*$/;

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
        : toPinnedCodeMirrorCompletionResult(context, situation.from, [{ items: columns, fallbackKind: 'column' }]);
    }

    if (situation.type === 'table') {
      const tables = await resolveTables(completionProvider);

      return context.aborted
        ? null
        : toPinnedCodeMirrorCompletionResult(context, situation.from, [{ items: tables, fallbackKind: 'table' }]);
    }

    if (situation.type === 'none') {
      return null;
    }

    const columns = await resolveColumnsForTables(completionProvider, situation.tables);
    const functions = await resolveFunctions(completionProvider);

    return context.aborted
      ? null
      : toCodeMirrorCompletionResult(situation.from, [
          { items: columns, fallbackKind: 'column' },
          { items: functions, fallbackKind: 'function' },
        ]);
  };
}

interface CompletionItemGroup {
  items: SqlCompletionItem[];
  fallbackKind: SqlCompletionKind;
}

function toCodeMirrorCompletionResult(from: number, groups: CompletionItemGroup[]): CodeMirrorCompletionResult {
  return {
    from,
    options: toCodeMirrorCompletions(groups),
    validFor: SQL_COMPLETION_VALID_FOR_PATTERN,
  };
}

function toPinnedCodeMirrorCompletionResult(
  context: CodeMirrorCompletionContext,
  from: number,
  groups: CompletionItemGroup[]
): CodeMirrorCompletionResult {
  const filterText = getCompletionFilterText(context, from);
  const options = toCodeMirrorCompletions(groups).filter((completion) =>
    matchesCompletionFilter(completion, filterText)
  );

  // CodeMirror keeps unfiltered source results above merged language/default results.
  return {
    from,
    options,
    filter: false,
    getMatch: (completion) => getCompletionMatch(completion.label, filterText),
  };
}

function toCodeMirrorCompletions(groups: CompletionItemGroup[]): CodeMirrorCompletion[] {
  return groups.flatMap(({ items, fallbackKind }) => items.map((item) => toCodeMirrorCompletion(item, fallbackKind)));
}

function toCodeMirrorCompletion(item: SqlCompletionItem, fallbackKind: SqlCompletionKind): CodeMirrorCompletion {
  const kind = item.kind ?? fallbackKind;

  return {
    label: item.label,
    apply: item.insertText,
    detail: item.detail,
    info: item.documentation,
    type: getCompletionType(kind),
    boost: item.boost,
  };
}

function getCompletionFilterText(context: CodeMirrorCompletionContext, from: number): string {
  return context.state.doc.sliceString(from, context.pos).toLowerCase();
}

function matchesCompletionFilter(completion: CodeMirrorCompletion, filterText: string): boolean {
  if (!filterText) {
    return true;
  }

  return [completion.label, typeof completion.apply === 'string' ? completion.apply : undefined].some((value) =>
    value?.toLowerCase().includes(filterText)
  );
}

function getCompletionMatch(label: string, filterText: string): number[] {
  if (!filterText) {
    return [];
  }

  const matchIndex = label.toLowerCase().indexOf(filterText);
  return matchIndex === -1 ? [] : [matchIndex, matchIndex + filterText.length];
}

function getCompletionType(kind: SqlCompletionKind): string {
  switch (kind) {
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
