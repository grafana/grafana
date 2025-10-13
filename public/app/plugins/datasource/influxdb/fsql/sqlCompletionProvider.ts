import {
  CompletionItemKind,
  CompletionItemPriority,
  getStandardSQLCompletionProvider,
  LanguageCompletionProvider,
  LinkedToken,
  PositionContext,
  StatementPlacementProvider,
  SuggestionKind,
  SuggestionKindProvider,
  TableDefinition,
  TableIdentifier,
  TokenType,
} from '@grafana/plugin-ui';

interface CompletionProviderGetterArgs {
  getMeta: (t?: TableIdentifier) => Promise<TableDefinition[]>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  ({ getMeta }) =>
  (monaco, language) => ({
    ...(language && getStandardSQLCompletionProvider(monaco, language)),
    customStatementPlacement: customStatementPlacementProvider,
    customSuggestionKinds: customSuggestionKinds(getMeta),
  });

const customStatementPlacement = {
  afterDatabase: 'afterDatabase',
};

const customSuggestionKind = {
  tablesWithinDatabase: 'tablesWithinDatabase',
};

const FROMKEYWORD = 'FROM';

export const customStatementPlacementProvider: StatementPlacementProvider = () => [
  {
    id: customStatementPlacement.afterDatabase,
    resolve: (currentToken, previousKeyword, previousNonWhiteSpace) => {
      return Boolean(
        currentToken?.is(TokenType.Delimiter, '.') &&
          previousKeyword?.value === FROMKEYWORD &&
          (previousNonWhiteSpace?.is(TokenType.IdentifierQuote) || previousNonWhiteSpace?.isIdentifier()) &&
          // don't match after table name
          currentToken
            ?.getPreviousUntil(TokenType.Keyword, [TokenType.IdentifierQuote], FROMKEYWORD)
            ?.filter((t) => t.isIdentifier()).length === 1
      );
    },
  },
];

export const customSuggestionKinds: (getMeta: CompletionProviderGetterArgs['getMeta']) => SuggestionKindProvider =
  (getMeta) => () => [
    {
      id: SuggestionKind.Tables,
      overrideDefault: true,
      suggestionsResolver: async (ctx) => {
        const databaseName = getDatabaseName(ctx.currentToken);

        const suggestions = await getMeta({ schema: databaseName });

        return suggestions.map(mapToSuggestion(ctx));
      },
    },
    {
      id: SuggestionKind.Columns,
      overrideDefault: true,
      suggestionsResolver: async (ctx) => {
        const databaseToken = getDatabaseToken(ctx.currentToken);
        const databaseName = getDatabaseName(databaseToken);
        const tableName = getTableName(databaseToken);

        if (!databaseName || !tableName) {
          return [];
        }

        const suggestions = await getMeta({ schema: databaseName, table: tableName });

        return suggestions.map(mapToSuggestion(ctx));
      },
    },
    {
      id: customSuggestionKind.tablesWithinDatabase,
      applyTo: [customStatementPlacement.afterDatabase],
      suggestionsResolver: async (ctx) => {
        const databaseName = getDatabaseName(ctx.currentToken);

        const suggestions = await getMeta({ schema: databaseName });

        return suggestions.map(mapToSuggestion(ctx));
      },
    },
  ];

function mapToSuggestion(ctx: PositionContext) {
  return function (tableDefinition: TableDefinition) {
    return {
      label: tableDefinition.name,
      insertText: tableDefinition.completion ?? tableDefinition.name,
      command: { id: 'editor.action.triggerSuggest', title: '' },
      kind: CompletionItemKind.Field,
      sortText: CompletionItemPriority.High,
      range: {
        ...ctx.range,
        startColumn: ctx.range.endColumn,
        endColumn: ctx.range.endColumn,
      },
    };
  };
}

function getDatabaseName(token: LinkedToken | null | undefined) {
  if (token?.isIdentifier() && token.value[token.value.length - 1] !== '.') {
    return token.value;
  }

  if (token?.is(TokenType.Delimiter, '.')) {
    return token.getPreviousOfType(TokenType.Identifier)?.value;
  }

  if (token?.is(TokenType.IdentifierQuote)) {
    return token.getPreviousOfType(TokenType.Identifier)?.value || token.getNextOfType(TokenType.Identifier)?.value;
  }
  return;
}

function getTableName(token: LinkedToken | null | undefined) {
  const identifier = token?.getNextOfType(TokenType.Identifier);
  return identifier?.value;
}

const getFromKeywordToken = (currentToken: LinkedToken | null) => {
  const selectToken = currentToken?.getPreviousOfType(TokenType.Keyword, 'SELECT') ?? null;
  return selectToken?.getNextOfType(TokenType.Keyword, FROMKEYWORD);
};

const getDatabaseToken = (currentToken: LinkedToken | null) => {
  const fromToken = getFromKeywordToken(currentToken);
  const nextIdentifier = fromToken?.getNextOfType(TokenType.Identifier);
  if (nextIdentifier?.isKeyword() && nextIdentifier.next?.is(TokenType.Parenthesis, '(')) {
    return null;
  } else {
    return nextIdentifier;
  }
};
