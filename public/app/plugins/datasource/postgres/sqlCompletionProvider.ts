import { TableIdentifier } from '@grafana/experimental';
import { AGGREGATE_FNS, OPERATORS } from 'app/features/plugins/sql/constants';
import {
  ColumnDefinition,
  DB,
  LanguageCompletionProvider,
  SQLQuery,
  TableDefinition,
} from 'app/features/plugins/sql/types';

import { FUNCTIONS } from '../mysql/functions';

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
    },
    columns: {
      resolve: async (t?: TableIdentifier) => {
        return await getColumns.current({ table: t?.table, refId: 'A' });
      },
    },
    supportedFunctions: () => [...AGGREGATE_FNS, ...FUNCTIONS],
    supportedOperators: () => OPERATORS,
  });

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

export async function fetchTables(db: DB) {
  const tables = await db.lookup();
  return tables;
}
