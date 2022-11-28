import { AGGREGATE_FNS, OPERATORS } from 'app/features/plugins/sql/constants';
import {
  Aggregate,
  ColumnDefinition,
  CompletionItemKind,
  CompletionItemPriority,
  DB,
  LanguageCompletionProvider,
  LinkedToken,
  MetaDefinition,
  PositionContext,
  SQLQuery,
  StatementPlacementProvider,
  StatementPosition,
  SuggestionKindProvider,
  TableDefinition,
  TokenType,
} from 'app/features/plugins/sql/types';

import { FUNCTIONS } from './functions';

interface CompletionProviderGetterArgs {
  getColumns: React.MutableRefObject<(t: SQLQuery) => Promise<ColumnDefinition[]>>;
  getTables: React.MutableRefObject<(d?: string) => Promise<TableDefinition[]>>;
  fetchMeta: React.MutableRefObject<(d?: string) => Promise<MetaDefinition[]>>;
  getFunctions: React.MutableRefObject<(d?: string) => Aggregate[]>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  ({ getColumns, getTables, fetchMeta, getFunctions }) =>
  () => ({
    triggerCharacters: ['.', ' ', '$', ',', '(', "'"],
    supportedFunctions: () => getFunctions.current(),
    supportedOperators: () => OPERATORS,
    customSuggestionKinds: customSuggestionKinds(getTables, getColumns, fetchMeta),
    customStatementPlacement,
  });

export enum CustomStatementPlacement {
  AfterDataset = 'afterDataset',
  AfterFrom = 'afterFrom',
  AfterSelect = 'afterSelect',
}

export enum CustomSuggestionKind {
  TablesWithinDataset = 'tablesWithinDataset',
}

export enum Direction {
  Next = 'next',
  Previous = 'previous',
}

const TRIGGER_SUGGEST = 'editor.action.triggerSuggest';

enum Keyword {
  Select = 'SELECT',
  Where = 'WHERE',
  From = 'FROM',
}

export const customStatementPlacement: StatementPlacementProvider = () => [
  {
    id: CustomStatementPlacement.AfterDataset,
    resolve: (currentToken, previousKeyword) => {
      return Boolean(
        currentToken?.is(TokenType.Delimiter, '.') ||
          (currentToken?.is(TokenType.Whitespace) && currentToken?.previous?.is(TokenType.Delimiter, '.'))
      );
    },
  },
  {
    id: CustomStatementPlacement.AfterFrom,
    resolve: (currentToken, previousKeyword) => {
      return Boolean(isAfterFrom(currentToken));
    },
  },
  {
    id: CustomStatementPlacement.AfterSelect,
    resolve: (token, previousKeyword) => {
      const is =
        isDirectlyAfter(token, Keyword.Select) ||
        (isAfterSelect(token) && token?.previous?.is(TokenType.Delimiter, ','));
      return Boolean(is);
    },
  },
];

export const customSuggestionKinds: (
  getTables: CompletionProviderGetterArgs['getTables'],
  getFields: CompletionProviderGetterArgs['getColumns'],
  fetchMeta: CompletionProviderGetterArgs['fetchMeta']
) => SuggestionKindProvider = (getTables, _, fetchMeta) => () =>
  [
    {
      id: CustomSuggestionKind.TablesWithinDataset,
      applyTo: [CustomStatementPlacement.AfterDataset],
      suggestionsResolver: async (ctx) => {
        const tablePath = ctx.currentToken ? getTablePath(ctx.currentToken) : '';
        const t = await getTables.current(tablePath);
        return t.map((table) => suggestion(table.name, table.completion ?? table.name, CompletionItemKind.Field, ctx));
      },
    },
    {
      id: 'metaAfterSelect',
      applyTo: [CustomStatementPlacement.AfterSelect],
      suggestionsResolver: async (ctx) => {
        const path = getPath(ctx.currentToken, Direction.Next);
        const t = await fetchMeta.current(path);
        return t.map((meta) => {
          const completion = meta.kind === CompletionItemKind.Class ? `${meta.completion}.` : meta.completion;
          return suggestion(meta.name, completion!, meta.kind, ctx);
        });
      },
    },
    {
      id: 'metaAfterSelectFuncArg',
      applyTo: [StatementPosition.AfterSelectFuncFirstArgument],
      suggestionsResolver: async (ctx) => {
        const path = getPath(ctx.currentToken, Direction.Next);
        const t = await fetchMeta.current(path);
        return t.map((meta) => {
          const completion = meta.kind === CompletionItemKind.Class ? `${meta.completion}.` : meta.completion;
          return suggestion(meta.name, completion!, meta.kind, ctx);
        });
      },
    },
    {
      id: 'metaAfterFrom',
      applyTo: [CustomStatementPlacement.AfterFrom],
      suggestionsResolver: async (ctx) => {
        // TODO: why is this triggering when isAfterFrom is false
        if (!isAfterFrom(ctx.currentToken)) {
          return [];
        }
        const path = ctx.currentToken?.value || '';
        const t = await fetchMeta.current(path);
        return t.map((meta) => suggestion(meta.name, meta.completion!, meta.kind, ctx));
      },
    },
    {
      id: `MYSQL${StatementPosition.WhereKeyword}`,
      applyTo: [StatementPosition.WhereKeyword],
      suggestionsResolver: async (ctx) => {
        const path = getPath(ctx.currentToken, Direction.Previous);
        const t = await fetchMeta.current(path);
        return t.map((meta) => {
          const completion = meta.kind === CompletionItemKind.Class ? `${meta.completion}.` : meta.completion;
          return suggestion(meta.name, completion!, meta.kind, ctx);
        });
      },
    },
    {
      id: StatementPosition.WhereComparisonOperator,
      applyTo: [StatementPosition.WhereComparisonOperator],
      suggestionsResolver: async (ctx) => {
        if (!isAfterWhere(ctx.currentToken)) {
          return [];
        }
        const path = getPath(ctx.currentToken, Direction.Previous);
        const t = await fetchMeta.current(path);
        const sugg = t.map((meta) => {
          const completion = meta.kind === CompletionItemKind.Class ? `${meta.completion}.` : meta.completion;
          return suggestion(meta.name, completion!, meta.kind, ctx);
        });
        return sugg;
      },
    },
  ];

function getPath(token: LinkedToken | null, direction: Direction) {
  let path = token?.value || '';
  const fromValue = keywordValue(token, Keyword.From, direction);
  if (fromValue) {
    path = fromValue;
  }
  return path;
}

export function getTablePath(token: LinkedToken) {
  let processedToken = token;
  let tablePath = '';
  while (processedToken?.previous && !processedToken.previous.isWhiteSpace()) {
    processedToken = processedToken.previous;
    tablePath = processedToken.value + tablePath;
  }

  tablePath = tablePath.trim();
  return tablePath;
}

function suggestion(label: string, completion: string, kind: CompletionItemKind, ctx: PositionContext) {
  return {
    label,
    insertText: completion,
    command: { id: TRIGGER_SUGGEST, title: '' },
    kind,
    sortText: CompletionItemPriority.High,
    range: {
      ...ctx.range,
      startColumn: ctx.range.endColumn,
      endColumn: ctx.range.endColumn,
    },
  };
}

function isAfterSelect(token: LinkedToken | null) {
  return isAfterKeyword(token, Keyword.Select);
}

function isAfterFrom(token: LinkedToken | null) {
  return isDirectlyAfter(token, Keyword.From);
}

function isAfterWhere(token: LinkedToken | null) {
  return isAfterKeyword(token, Keyword.Where);
}

function isAfterKeyword(token: LinkedToken | null, keyword: string) {
  if (!token?.is(TokenType.Keyword)) {
    let curToken = token;
    while (true) {
      if (!curToken) {
        return false;
      }
      if (curToken.is(TokenType.Keyword, keyword)) {
        return true;
      }
      if (curToken.isKeyword()) {
        return false;
      }
      curToken = curToken?.previous || null;
    }
  }
  return false;
}

function isDirectlyAfter(token: LinkedToken | null, keyword: string) {
  return token?.is(TokenType.Whitespace) && token?.previous?.is(TokenType.Keyword, keyword);
}

function keywordValue(token: LinkedToken | null, keyword: Keyword, direction: Direction) {
  let next = token;
  while (next) {
    if (next.is(TokenType.Keyword, keyword)) {
      return tokenValue(next);
    }
    next = next[direction];
  }
  return false;
}

function tokenValue(token: LinkedToken | null): string | undefined {
  const ws = token?.next;
  if (ws?.isWhiteSpace()) {
    const v = ws.next;
    const delim = v?.next;
    if (!delim?.is(TokenType.Delimiter)) {
      return v?.value;
    }
    return `${v?.value}${delim?.value}${delim.next?.value}`;
  }
  return undefined;
}

export async function fetchColumns(db: DB, q: SQLQuery) {
  const cols = await db.fields(q);
  if (cols.length > 0) {
    return cols.map((c) => {
      return { name: c.value, type: c.value, description: c.value };
    });
  } else {
    return [];
  }
}

export async function fetchTables(db: DB, q: Partial<SQLQuery>) {
  const tables = await db.lookup(q.dataset);
  return tables;
}

export function getFunctions(): Aggregate[] {
  return [...AGGREGATE_FNS, ...FUNCTIONS];
}
