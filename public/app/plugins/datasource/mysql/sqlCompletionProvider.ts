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
import { DB, MetaDefinition, SQLQuery } from '../sql/types';

interface CompletionProviderGetterArgs {
  getColumns: React.MutableRefObject<(t: SQLQuery) => Promise<ColumnDefinition[]>>;
  getTables: React.MutableRefObject<(d?: string) => Promise<TableDefinition[]>>;
  fetchMeta: React.MutableRefObject<(d?: string) => Promise<MetaDefinition[]>>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  ({ getColumns, getTables, fetchMeta }) =>
  () => ({
    triggerCharacters: ['.', ' ', '$', ',', '(', "'"],
    // tables: {
    //   resolve: async () => {
    //     return await getTables.current();
    //   },
    //   parseName: (token: LinkedToken) => {
    //     let processedToken = token;
    //     let tablePath = processedToken.value;

    //     while (processedToken.next) {
    //       tablePath += processedToken.next.value;
    //       processedToken = processedToken.next;
    //     }

    //     return tablePath;
    //   },
    // },

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
  AfterFrom = 'afterFrom',
}

export enum CustomSuggestionKind {
  TablesWithinDataset = 'tablesWithinDataset',
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
      id: `MYSQL${StatementPosition.WhereKeyword}`,
      applyTo: [StatementPosition.WhereKeyword],
      suggestionsResolver: async (ctx) => {
        console.log('where ' + ctx.currentToken?.value);

        // const tablePath = ctx.currentToken ? getTablePath(ctx.currentToken) : '';
        const path = ctx.currentToken?.value || '';
        console.log(path);
        const t = await fetchMeta.current(path);
        console.log(t);
        return t.map((meta) => {
          const completion = meta.kind === CompletionItemKind.Class ? `${meta.completion}.` : meta.completion;
          return {
            label: meta.name,
            insertText: completion,
            command: { id: 'editor.action.triggerSuggest', title: '' },
            kind: meta.kind,
            sortText: CompletionItemPriority.High,
            range: {
              ...ctx.range,
              startColumn: ctx.range.endColumn,
              endColumn: ctx.range.endColumn,
            },
          };
        });
      },
    },
    {
      id: StatementPosition.WhereComparisonOperator,
      applyTo: [StatementPosition.WhereComparisonOperator],
      suggestionsResolver: async (ctx) => {
        console.log('where oper' + ctx.currentToken?.value);

        if (!isAfterWhere(ctx.currentToken)) {
          return [];
        }
        // const tablePath = ctx.currentToken ? getTablePath(ctx.currentToken) : '';
        const path = ctx.currentToken?.value || '';
        console.log(path);
        const t = await fetchMeta.current(path);
        console.log(t);
        const sugg = t.map((meta) => {
          const completion = meta.kind === CompletionItemKind.Class ? `${meta.completion}.` : meta.completion;
          return {
            label: meta.name,
            insertText: completion,
            command: { id: 'editor.action.triggerSuggest', title: '' },
            kind: meta.kind,
            sortText: CompletionItemPriority.High,
            range: {
              ...ctx.range,
              startColumn: ctx.range.endColumn,
              endColumn: ctx.range.endColumn,
            },
          };
        });
        return sugg;
      },
    },
    {
      id: 'metaAfterSelect',
      applyTo: [StatementPosition.AfterSelectKeyword],
      suggestionsResolver: async (ctx) => {
        console.log('after select ' + ctx.currentToken?.value);
        // const tablePath = ctx.currentToken ? getTablePath(ctx.currentToken) : '';
        const path = ctx.currentToken?.value || '';
        console.log(path);
        const t = await fetchMeta.current(path);
        console.log(t);
        return t.map((meta) => {
          const completion = meta.kind === CompletionItemKind.Class ? `${meta.completion}.` : meta.completion;
          return {
            label: meta.name,
            insertText: completion,
            command: { id: 'editor.action.triggerSuggest', title: '' },
            kind: meta.kind,
            sortText: CompletionItemPriority.High,
            range: {
              ...ctx.range,
              startColumn: ctx.range.endColumn,
              endColumn: ctx.range.endColumn,
            },
          };
        });
      },
    },
    {
      id: 'metaAfterFrom',
      applyTo: [CustomStatementPlacement.AfterFrom],
      suggestionsResolver: async (ctx) => {
        console.log('after from ' + ctx.currentToken?.value + ' ' + ctx.currentToken?.previous?.value);
        // TODO: why is this triggering when isAfterFrom is false
        if (!isAfterFrom(ctx.currentToken)) {
          return [];
        }
        const path = ctx.currentToken?.value || '';
        console.log(path);
        const t = await fetchMeta.current(path);
        console.log(t);
        return t.map((meta) => {
          return {
            label: meta.name,
            insertText: meta.completion,
            command: { id: 'editor.action.triggerSuggest', title: '' },
            kind: meta.kind,
            sortText: CompletionItemPriority.High,
            range: {
              ...ctx.range,
              startColumn: ctx.range.endColumn,
              endColumn: ctx.range.endColumn,
            },
          };
        });
      },
    },
    {
      id: `MYSQL${StatementPosition.WhereComparisonOperator}`,
      applyTo: [StatementPosition.WhereComparisonOperator],
      suggestionsResolver: async (ctx) => {
        console.log('where oper 2' + ctx.currentToken?.value);
        return [];
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

function isAfterFrom(token: LinkedToken | null) {
  return isAfter(token, 'FROM');
}

function isAfterWhere(token: LinkedToken | null) {
  return isAfter(token, 'WHERE');
}

function isAfter(token: LinkedToken | null, keyword: string) {
  return token?.is(TokenType.Whitespace) && token?.previous?.is(TokenType.Keyword, keyword);
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
