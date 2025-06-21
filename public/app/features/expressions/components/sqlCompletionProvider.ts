import { SelectableValue } from '@grafana/data';
import { ColumnDefinition, LanguageCompletionProvider, TableDefinition, TableIdentifier } from '@grafana/plugin-ui';

interface CompletionProviderGetterArgs {
  getMeta: (t: TableIdentifier) => Promise<ColumnDefinition[]>;
  refIds: Array<SelectableValue<string>>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  (args) => (monaco, language) => ({
    ...language,
    triggerCharacters: [' '],
    tables: {
      resolve: async () => {
        const refIdsToTableDefs = args.refIds.map((refId) => {
          const tableDef: TableDefinition = {
            name: refId.label || refId.value || '',
            completion: refId.label || refId.value || '',
          };
          return tableDef;
        });
        return refIdsToTableDefs;
      },
    },
    columns: {
      resolve: async (t?: TableIdentifier) => {
        return await args.getMeta({ table: t?.table });
      },
    },
  });
