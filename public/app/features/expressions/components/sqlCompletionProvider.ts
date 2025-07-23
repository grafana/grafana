import { SelectableValue } from '@grafana/data';
import { ColumnDefinition, LanguageCompletionProvider, TableDefinition, TableIdentifier } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';

import { ALLOWED_FUNCTIONS } from '../utils/metaSqlExpr';

interface CompletionProviderGetterArgs {
  getFields: (t: TableIdentifier) => Promise<ColumnDefinition[]>;
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
        if (config.featureToggles.sqlExpressionsColumnAutoComplete) {
          try {
            return await args.getFields({ table: t?.table });
          } catch {
            return [];
          }
        } else {
          return [];
        }
      },
    },
    supportedFunctions: () => {
      return ALLOWED_FUNCTIONS.map((func) => {
        return { id: func, name: func };
      });
    },
  });
