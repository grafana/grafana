import {
  ColumnDefinition,
  getStandardSQLCompletionProvider,
  LanguageCompletionProvider,
  LinkedToken,
  TableDefinition,
  TableIdentifier,
  TokenType,
} from '@grafana/plugin-ui';
import { DB, SQLQuery } from '@grafana/sql';

interface CompletionProviderGetterArgs {
  getColumns: React.MutableRefObject<(t: SQLQuery) => Promise<ColumnDefinition[]>>;
  getTables: React.MutableRefObject<(d?: string) => Promise<TableDefinition[]>>;
}

export const getSqlCompletionProvider: (args: CompletionProviderGetterArgs) => LanguageCompletionProvider =
  ({ getColumns, getTables }) =>
  (monaco, language) => ({
    ...(language && getStandardSQLCompletionProvider(monaco, language)),
    tables: {
      resolve: async (identifier) => {
        return await getTables.current(identifier?.table);
      },
      parseName: (token: LinkedToken | undefined | null) => {
        if (!token) {
          return { table: '' };
        }

        let processedToken = token;
        let tablePath = processedToken.value;

        while (processedToken.next && processedToken.next.type !== TokenType.Whitespace) {
          tablePath += processedToken.next.value;
          processedToken = processedToken.next;
        }

        if (processedToken.value.endsWith('.')) {
          tablePath = processedToken.value.slice(0, processedToken.value.length - 1);
        }

        return { table: tablePath };
      },
    },

    columns: {
      resolve: async (t: TableIdentifier | undefined) => {
        if (!t?.table) {
          return [];
        }
        // TODO: Use schema instead of table
        const [database, schema, tableName] = t.table.split('.');
        return await getColumns.current({ table: `${schema}.${tableName}`, dataset: database, refId: 'A' });
      },
    },
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

export async function fetchTables(db: DB, dataset?: string) {
  const tables = await db.lookup?.(dataset);
  return tables || [];
}
