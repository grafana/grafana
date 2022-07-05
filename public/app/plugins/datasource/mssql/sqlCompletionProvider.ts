// import { useCallback } from 'react';

import {
  ColumnDefinition,
  CompletionItemKind,
  CompletionItemPriority,
  LanguageCompletionProvider,
  LinkedToken,
  StatementPlacementProvider,
  // StatementPosition,
  SuggestionKindProvider,
  TableDefinition,
  TokenType,
} from '@grafana/experimental';
import { AGGREGATE_FNS, OPERATORS } from 'app/features/plugins/sql/constants';
import { DB, SQLQuery } from 'app/features/plugins/sql/types';

interface CompletionProviderGetterArgs {
  getColumns: React.MutableRefObject<(t: SQLQuery) => Promise<ColumnDefinition[]>>;
  getTables: React.MutableRefObject<(d?: string) => Promise<TableDefinition[]>>;
  // getTableSchema: React.MutableRefObject<(p: string, d: string, t: string) => Promise<TableSchema | null>>;
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

        while (processedToken.next) {
          tablePath += processedToken.next.value;
          processedToken = processedToken.next;
        }

        return tablePath;
      },
    },

    columns: {
      resolve: async (t: string) => {
        // TODO - seems like a limitation in experimental since we may need database and table to get columns
        // use . as delimiter?
        // const cols = await getColumns({ table: t } as SQLQuery);
        return await getColumns.current({ table: t, refId: 'A' });
      },
    },
    supportedFunctions: () => AGGREGATE_FNS,
    supportedOperators: () => OPERATORS,
    customSuggestionKinds: customSuggestionKinds(getTables, getColumns),
    customStatementPlacement,
  });

export enum CustomStatementPlacement {
  AfterDataset = 'afterDataset',
}

export enum CustomSuggestionKind {
  TablesWithinDataset = 'tablesWithinDataset',
  Partition = 'partition',
}

export const customStatementPlacement: StatementPlacementProvider = () => [
  {
    id: CustomStatementPlacement.AfterDataset,
    resolve: (currentToken, previousKeyword) => {
      return Boolean(
        currentToken?.is(TokenType.Delimiter, '.') ||
          (currentToken?.is(TokenType.Whitespace) && currentToken?.previous?.is(TokenType.Delimiter, '.')) ||
          // (currentToken?.value === '`' && currentToken?.previous?.is(TokenType.Delimiter, '.')) ||
          (currentToken?.isNumber() && currentToken.value.endsWith('.')) // number with dot at the end like "projectname-21342."
        // (currentToken?.value === '`' && isTypingTableIn(currentToken))
      );
    },
  },
  // TODO - remove - frin big query
  // Overriding default behaviour of AfterFrom resolver
  // {
  //   id: StatementPosition.AfterFrom,
  //   overrideDefault: true,
  //   resolve: (currentToken) => {
  //     const untilFrom = currentToken?.getPreviousUntil(TokenType.Keyword, [], 'from');
  //     if (!untilFrom) {
  //       return false;
  //     }
  //     let q = '';
  //     for (let i = untilFrom?.length - 1; i >= 0; i--) {
  //       q += untilFrom[i].value;
  //     }

  //     return q.startsWith('`') && q.endsWith('`');
  //   },
  // },
];

export const customSuggestionKinds: (
  getTables: CompletionProviderGetterArgs['getTables'],
  getFields: CompletionProviderGetterArgs['getColumns']
  // getTableSchema: CompletionProviderGetterArgs['getTableSchema']
) => SuggestionKindProvider = (getTables) => () =>
  [
    {
      id: CustomSuggestionKind.TablesWithinDataset,
      applyTo: [CustomStatementPlacement.AfterDataset],
      suggestionsResolver: async (ctx) => {
        const tablePath = ctx.currentToken ? getTablePath(ctx.currentToken) : '';
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
    // {
    //   id: CustomSuggestionKind.TablesWithinDataset,
    //   applyTo: [StatementPosition.AfterFrom],
    //   suggestionsResolver: async (ctx) => {
    //     console.log('after from');
    //     const tablePath = ctx.currentToken ? getTablePath(ctx.currentToken) : '';
    //     const t = await getTables.current(tablePath);

    //     return t.map((table) => ({
    //       label: table.name,
    //       insertText: table.completion ?? table.name,
    //       command: { id: 'editor.action.triggerSuggest', title: '' },
    //       kind: CompletionItemKind.Field,
    //       sortText: CompletionItemPriority.High,
    //       range: {
    //         ...ctx.range,
    //         startColumn: ctx.range.endColumn,
    //         endColumn: ctx.range.endColumn,
    //       },
    //     }));
    //   }
    // }
  ];

export function getTablePath(token: LinkedToken) {
  let processedToken = token;
  let tablePath = '';
  while (processedToken?.previous && !processedToken.previous.isWhiteSpace()) {
    processedToken = processedToken.previous;
    tablePath = processedToken.value + tablePath;
  }

  tablePath = tablePath.trim();

  // TODO - remove - frin big query

  // if (tablePath.startsWith('`')) {
  //   tablePath = tablePath.slice(1);
  // }

  // if (tablePath.endsWith('`')) {
  //   tablePath = tablePath.slice(0, -1);
  // }

  return tablePath;
}

// TODO - not sure if we need this
// function isTypingTableIn(token: LinkedToken | null, l?: boolean) {
//   if (!token) {
//     return false;
//   }
//   const tokens = token.getPreviousUntil(TokenType.Keyword, [], 'from');
//   if (!tokens) {
//     return false;
//   }

//   let path = '';
//   for (let i = tokens.length - 1; i >= 0; i--) {
//     path += tokens[i].value;
//   }

//   // TODO - remove - frin big query
//   // if (path.startsWith('`')) {
//   //   path = path.slice(1);
//   // }

//   return path.split('.').length === 2;
// }

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
