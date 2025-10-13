import { quoteLiteral, unquoteIdentifier } from './sqlUtil';

export function buildTableQuery(dataset?: string) {
  const database = dataset !== undefined ? quoteIdentAsLiteral(dataset) : 'database()';
  return `SELECT table_name FROM information_schema.tables WHERE table_schema = ${database} ORDER BY table_name`;
}

export function showDatabases() {
  return `SELECT DISTINCT TABLE_SCHEMA from information_schema.TABLES where TABLE_TYPE != 'SYSTEM VIEW' ORDER BY TABLE_SCHEMA`;
}

export function buildColumnQuery(table: string, dbName?: string) {
  let query = 'SELECT column_name, data_type FROM information_schema.columns WHERE ';
  query += buildTableConstraint(table, dbName);

  query += ' ORDER BY column_name';

  return query;
}

export function buildTableConstraint(table: string, dbName?: string) {
  let query = '';

  // check for schema qualified table
  if (table.includes('.')) {
    const parts = table.split('.');
    query = 'table_schema = ' + quoteIdentAsLiteral(parts[0]);
    query += ' AND table_name = ' + quoteIdentAsLiteral(parts[1]);
    return query;
  } else {
    const database = dbName !== undefined ? quoteIdentAsLiteral(dbName) : 'database()';
    query = `table_schema = ${database} AND table_name = ` + quoteIdentAsLiteral(table);

    return query;
  }
}

export function quoteIdentAsLiteral(value: string) {
  return quoteLiteral(unquoteIdentifier(value));
}
