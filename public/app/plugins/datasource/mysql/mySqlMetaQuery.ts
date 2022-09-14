import MySQLQueryModel from './MySqlQueryModel';

export function buildTableQuery(dataset?: string) {
  const database = dataset !== undefined ? `'${dataset}'` : 'database()';
  return `SELECT table_name FROM information_schema.tables WHERE table_schema = ${database} ORDER BY table_name`;
}

export function showDatabases() {
  return `SELECT DISTINCT TABLE_SCHEMA from information_schema.TABLES where TABLE_TYPE != 'SYSTEM VIEW' ORDER BY TABLE_SCHEMA`;
}

export function buildColumnQuery(queryModel: MySQLQueryModel, table: string, type?: string, timeColumn?: string) {
  let query = 'SELECT column_name, data_type FROM information_schema.columns WHERE ';
  query += buildTableConstraint(queryModel, table);

  switch (type) {
    case 'time': {
      query += " AND data_type IN ('timestamp','datetime','bigint','int','double','float')";
      break;
    }
    case 'metric': {
      query += " AND data_type IN ('text','tinytext','mediumtext','longtext','varchar','char')";
      break;
    }
    case 'value': {
      query += " AND data_type IN ('bigint','int','smallint','mediumint','tinyint','double','decimal','float')";
      query += ' AND column_name <> ' + quoteIdentAsLiteral(queryModel, timeColumn!);
      break;
    }
    case 'group': {
      query += " AND data_type IN ('text','tinytext','mediumtext','longtext','varchar','char')";
      break;
    }
  }

  query += ' ORDER BY column_name';

  return query;
}

export function buildTableConstraint(queryModel: MySQLQueryModel, table: string) {
  let query = '';

  // check for schema qualified table
  if (table.includes('.')) {
    const parts = table.split('.');
    query = 'table_schema = ' + quoteIdentAsLiteral(queryModel, parts[0]);
    query += ' AND table_name = ' + quoteIdentAsLiteral(queryModel, parts[1]);
    return query;
  } else {
    const database = queryModel.getDatabase() !== undefined ? `'${queryModel.getDatabase()}'` : 'database()';
    query = `table_schema = ${database} AND table_name = ` + quoteIdentAsLiteral(queryModel, table);

    return query;
  }
}

export function quoteIdentAsLiteral(queryModel: MySQLQueryModel, value: string) {
  return queryModel.quoteLiteral(queryModel.unquoteIdentifier(value));
}
