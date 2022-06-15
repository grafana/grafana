import {
  ColumnDefinition,
  CompletionItemKind,
  CompletionItemPriority,
  LanguageCompletionProvider,
  LinkedToken,
  StatementPlacementProvider,
  StatementPosition,
  SuggestionKindProvider,
  TableDefinition,
  TokenType,
} from '@grafana/experimental';

import { AGGREGATE_FNS, OPERATORS } from '../sql/constants';
import { DB, SQLQuery } from '../sql/types';

interface CompletionProviderGetterArgs {
  getColumns: React.MutableRefObject<(t: SQLQuery) => Promise<ColumnDefinition[]>>;
  getTables: React.MutableRefObject<(d?: string) => Promise<TableDefinition[]>>;
  fetchMeta: React.MutableRefObject<(d?: string) => Promise<TableDefinition[]>>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  ({ getColumns, getTables, fetchMeta }) =>
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
        return await getColumns.current({ table: t } as SQLQuery);
      },
    },
    supportedFunctions: () => AGGREGATE_FNS,
    supportedOperators: () => OPERATORS,
    customSuggestionKinds: customSuggestionKinds(getTables, getColumns, fetchMeta),
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
          (currentToken?.isNumber() && currentToken.value.endsWith('.')) // number with dot at the end like "projectname-21342."
      );
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
    {
      id: 'metaAfterWhere',
      applyTo: [StatementPosition.WhereKeyword],
      suggestionsResolver: async (ctx) => {
        // console.log('after where ' + ctx.currentToken?.value);
        // const tablePath = ctx.currentToken ? getTablePath(ctx.currentToken) : '';
        const tablePath = ctx.currentToken?.value || '';
        console.log(tablePath);
        const t = await fetchMeta.current(tablePath);
        console.log(t);
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

export async function fetchTables(db: DB, q: SQLQuery) {
  const tables = await db.lookup(q.dataset);
  return tables;
}
