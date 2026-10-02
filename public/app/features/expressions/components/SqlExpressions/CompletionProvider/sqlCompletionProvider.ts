import { type SelectableValue } from '@grafana/data';
import {
  type ColumnDefinition,
  type LanguageCompletionProvider,
  type TableDefinition,
  type TableIdentifier,
} from '@grafana/plugin-ui';
import { quoteIdentifierIfNecessary } from '@grafana/sql';

import { ALLOWED_FUNCTIONS } from '../../../utils/metaSqlExpr';
import { SQL_EXPRESSIONS_DIALECT } from '../../../utils/sqlIdentifier';

interface CompletionProviderGetterArgs {
  getFields: (t: TableIdentifier) => Promise<ColumnDefinition[]>;
  refIds: Array<SelectableValue<string>>;
  columnAutoCompleteEnabled: boolean;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  (args) => (monaco, language) => ({
    ...language,
    triggerCharacters: [' '],
    tables: {
      resolve: async () => {
        const refIdsToTableDefs = args.refIds.map((refId) => {
          const name = refId.label || refId.value || '';
          const tableDef: TableDefinition = {
            name,
            completion: quoteIdentifierIfNecessary(name, SQL_EXPRESSIONS_DIALECT),
          };
          return tableDef;
        });
        return refIdsToTableDefs;
      },
    },
    columns: {
      resolve: async (t?: TableIdentifier) => {
        if (args.columnAutoCompleteEnabled) {
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
