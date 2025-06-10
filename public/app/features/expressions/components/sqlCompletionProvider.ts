import { SelectableValue } from '@grafana/data';
import {
  CompletionItemKind,
  CompletionItemPriority,
  getStandardSQLCompletionProvider,
  LanguageCompletionProvider,
  LinkedToken,
  PositionContext,
  SuggestionKind,
  SuggestionKindProvider,
  TableDefinition,
  TableIdentifier,
  TokenType,
} from '@grafana/plugin-ui';

interface CompletionProviderGetterArgs {
  getMeta: (t: TableIdentifier) => Promise<TableDefinition[]>;
  refIds: Array<SelectableValue<string>>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  (args) => (monaco, language) => ({
    ...(language && getStandardSQLCompletionProvider(monaco, language)),
    customSuggestionKinds: customSuggestionKinds(args),
  });

export const customSuggestionKinds: (args: CompletionProviderGetterArgs) => SuggestionKindProvider = (args) => () => [
  {
    id: SuggestionKind.Tables,
    overrideDefault: true,
    suggestionsResolver: async (ctx) => {
      const refIdsToTableDefs = args.refIds.map((refId) => {
        const tableDef: TableDefinition = {
          name: refId.label || refId.value || '',
          completion: refId.label || refId.value || '',
        };
        return tableDef;
      });
      return refIdsToTableDefs.map(mapToSuggestion(ctx));
    },
  },
  {
    id: SuggestionKind.Columns,
    overrideDefault: true,
    suggestionsResolver: async (ctx) => {
      const table = getTableName(ctx.currentToken);
      const suggestions = await args.getMeta({ table });
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

function getTableName(token: LinkedToken | null | undefined) {
  const identifier = token?.getNextOfType(TokenType.Identifier);
  return identifier?.value;
}
