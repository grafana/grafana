import { AGGREGATE_FNS, OPERATORS } from 'app/features/plugins/sql/constants';
import {
  ColumnDefinition,
  CompletionItemKind,
  CompletionItemPriority,
  DB,
  LanguageCompletionProvider,
  LinkedToken,
  SQLQuery,
  StatementPlacementProvider,
  SuggestionKindProvider,
  TableDefinition,
  TokenType,
} from 'app/features/plugins/sql/types';

import { SCHEMA_NAME } from './sqlUtil';

interface CompletionProviderGetterArgs {
  getColumns: React.MutableRefObject<(t: SQLQuery) => Promise<ColumnDefinition[]>>;
  getTables: React.MutableRefObject<(d?: string) => Promise<TableDefinition[]>>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  ({ getColumns, getTables }) =>
  () => ({
    triggerCharacters: ['.', ' ', '$', ',', '(', "'"],
    tables: {
      resolve: async () => {
        return await getTables.current();
      },
      parseName: (token: LinkedToken) => {
        let processedToken = token;
        let tablePath = processedToken.value;

        while (processedToken.next && processedToken.next.type !== TokenType.Whitespace) {
          tablePath += processedToken.next.value;
          processedToken = processedToken.next;
        }

        const tableName = tablePath.split('.').pop();

        return tableName || tablePath;
      },
    },

    columns: {
      resolve: async (t: string) => {
        return await getColumns.current({ table: t, refId: 'A' });
      },
    },
    supportedFunctions: () => AGGREGATE_FNS,
    supportedOperators: () => OPERATORS,
    customSuggestionKinds: customSuggestionKinds(getTables, getColumns),
    customStatementPlacement,
  });

export enum CustomStatementPlacement {
  AfterDatabase = 'afterDatabase',
}

export enum CustomSuggestionKind {
  TablesWithinDatabase = 'tablesWithinDatabase',
}

export const customStatementPlacement: StatementPlacementProvider = () => [
  {
    id: CustomStatementPlacement.AfterDatabase,
    resolve: (currentToken, previousKeyword) => {
      return Boolean(
        currentToken?.is(TokenType.Delimiter, '.') ||
          (currentToken?.is(TokenType.Whitespace) && currentToken?.previous?.is(TokenType.Delimiter, '.')) ||
          (currentToken?.isNumber() && currentToken.value.endsWith('.'))
      );
    },
  },
];

export const customSuggestionKinds: (
  getTables: CompletionProviderGetterArgs['getTables'],
  getFields: CompletionProviderGetterArgs['getColumns']
) => SuggestionKindProvider = (getTables) => () =>
  [
    {
      id: CustomSuggestionKind.TablesWithinDatabase,
      applyTo: [CustomStatementPlacement.AfterDatabase],
      suggestionsResolver: async (ctx) => {
        const tablePath = ctx.currentToken ? getDatabaseName(ctx.currentToken) : '';
        const t = await getTables.current(tablePath);

        return t.map((table) => ({
          label: table.name,
          insertText: table.completion ?? table.name,
          command: { id: 'editor.action.triggerSuggest', title: '' },
          kind: CompletionItemKind.Field,
          sortText: CompletionItemPriority.High,
          range: {
            ...ctx.range,
            startColumn: ctx.range.endColumn,
            endColumn: ctx.range.endColumn,
          },
        }));
      },
    },
  ];

export function getDatabaseName(token: LinkedToken) {
  let processedToken = token;
  let database = '';
  while (processedToken?.previous && !processedToken.previous.isWhiteSpace()) {
    processedToken = processedToken.previous;
    database = processedToken.value + database;
  }

  if (database.includes(SCHEMA_NAME)) {
    database = database.replace(SCHEMA_NAME, '');
  }

  database = database.trim();

  return database;
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

export async function fetchTables(db: DB, dataset?: string) {
  const tables = await db.lookup(dataset);
  return tables;
}
