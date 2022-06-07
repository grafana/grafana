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

import { AGGREGATE_FNS, OPERATORS } from '../../constants';
import { SQLQuery, TableSchema } from '../../types';

interface CompletionProviderGetterArgs {
  getColumns: React.MutableRefObject<(t: SQLQuery) => Promise<ColumnDefinition[]>>;
  getTables: React.MutableRefObject<(d?: string) => Promise<TableDefinition[]>>;
  getTableSchema: React.MutableRefObject<(p: string, d: string, t: string) => Promise<TableSchema | null>>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  ({ getColumns, getTables, getTableSchema }) =>
  () => ({
    triggerCharacters: ['.', ' ', '$', ',', '(', "'"],
    tables: {
      resolve: async () => {
        return await getTables.current();
      },
      parseName: (token: LinkedToken) => {
        let processedToken = token;
        let tablePath = processedToken.value;

        while (processedToken.next && processedToken?.next?.value !== '`') {
          tablePath += processedToken.next.value;
          processedToken = processedToken.next;
        }

        if (tablePath.trim().startsWith('`')) {
          return tablePath.slice(1);
        }

        return tablePath;
      },
    },

    columns: {
      resolve: async (t: string) => {
        // TODO - seems like a limitation in experimental since we may need database and table to get columns
        // use . as delimiter?
        return await getColumns.current({ table: t } as SQLQuery);
      },
    },
    supportedFunctions: () => AGGREGATE_FNS,
    supportedOperators: () => OPERATORS,
    customSuggestionKinds: customSuggestionKinds(getTables, getTableSchema),
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
          (currentToken?.value === '`' && currentToken?.previous?.is(TokenType.Delimiter, '.')) ||
          (currentToken?.isNumber() && currentToken.value.endsWith('.')) || // number with dot at the end like "projectname-21342."
          (currentToken?.value === '`' && isTypingTableIn(currentToken))
      );
    },
  },
  // Overriding default behaviour of AfterFrom resolver
  {
    id: StatementPosition.AfterFrom,
    overrideDefault: true,
    resolve: (currentToken) => {
      const untilFrom = currentToken?.getPreviousUntil(TokenType.Keyword, [], 'from');
      if (!untilFrom) {
        return false;
      }
      let q = '';
      for (let i = untilFrom?.length - 1; i >= 0; i--) {
        q += untilFrom[i].value;
      }

      return q.startsWith('`') && q.endsWith('`');
    },
  },
];

export const customSuggestionKinds: (
  getTables: CompletionProviderGetterArgs['getTables'],
  getTableSchema: CompletionProviderGetterArgs['getTableSchema']
) => SuggestionKindProvider = (getTables, getTableSchema) => () =>
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
  ];

export function getTablePath(token: LinkedToken) {
  let processedToken = token;
  let tablePath = '';
  while (processedToken?.previous && !processedToken.previous.isWhiteSpace()) {
    tablePath = processedToken.value + tablePath;
    processedToken = processedToken.previous;
  }

  tablePath = tablePath.trim();

  if (tablePath.startsWith('`')) {
    tablePath = tablePath.slice(1);
  }

  if (tablePath.endsWith('`')) {
    tablePath = tablePath.slice(0, -1);
  }

  return tablePath;
}

function isTypingTableIn(token: LinkedToken | null, l?: boolean) {
  if (!token) {
    return false;
  }
  const tokens = token.getPreviousUntil(TokenType.Keyword, [], 'from');
  if (!tokens) {
    return false;
  }

  let path = '';
  for (let i = tokens.length - 1; i >= 0; i--) {
    path += tokens[i].value;
  }

  if (path.startsWith('`')) {
    path = path.slice(1);
  }

  return path.split('.').length === 2;
}
