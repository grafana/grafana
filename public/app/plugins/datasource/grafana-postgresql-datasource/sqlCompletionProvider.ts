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
      resolve: async () => {
        return await getTables.current();
      },
      // Default parser doesn't handle schema.table syntax
      parseName: (token: LinkedToken | undefined | null) => {
        if (!token) {
          return { table: '' };
        }

        let processedToken = token;
        let tablePath = processedToken.value;

        // Parse schema.table syntax
        while (processedToken.next && processedToken.next.type !== TokenType.Whitespace) {
          tablePath += processedToken.next.value;
          processedToken = processedToken.next;
        }

        return { table: tablePath };
      },
    },
    columns: {
      resolve: async (t?: TableIdentifier) => {
        return await getColumns.current({ table: t?.table, refId: 'A' });
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

export async function fetchTables(db: DB) {
  const tables = await db.lookup?.();
  return tables || [];
}
