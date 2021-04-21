import { DataQuery } from '@grafana/data';
import { quoteLiteral, unquoteIdentifier } from './sql';

export class MySqlMetaQuery {
  constructor(private target: DataQuery) {}

  getOperators(datatype: string) {
    switch (datatype) {
      case 'double':
      case 'float': {
        return ['=', '!=', '<', '<=', '>', '>='];
      }
      case 'text':
      case 'tinytext':
      case 'mediumtext':
      case 'longtext':
      case 'varchar':
      case 'char': {
        return ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE'];
      }
      default: {
        return ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN'];
      }
    }
  }

  // quote identifier as literal to use in metadata queries
  quoteIdentAsLiteral(value: string) {
    return quoteLiteral(unquoteIdentifier(value));
  }

  findMetricTable() {
    // query that returns first table found that has a timestamp(tz) column and a float column
    const query = `
  SELECT
    table_name as table_name,
    ( SELECT
        column_name as column_name
      FROM information_schema.columns c
      WHERE
        c.table_schema = t.table_schema AND
        c.table_name = t.table_name AND
        c.data_type IN ('timestamp', 'datetime')
      ORDER BY ordinal_position LIMIT 1
    ) AS time_column,
    ( SELECT
        column_name AS column_name
      FROM information_schema.columns c
      WHERE
        c.table_schema = t.table_schema AND
        c.table_name = t.table_name AND
        c.data_type IN('float', 'int', 'bigint')
      ORDER BY ordinal_position LIMIT 1
    ) AS value_column
  FROM information_schema.tables t
  WHERE
    t.table_schema = database() AND
    EXISTS
    ( SELECT 1
      FROM information_schema.columns c
      WHERE
        c.table_schema = t.table_schema AND
        c.table_name = t.table_name AND
        c.data_type IN ('timestamp', 'datetime')
    ) AND
    EXISTS
    ( SELECT 1
      FROM information_schema.columns c
      WHERE
        c.table_schema = t.table_schema AND
        c.table_name = t.table_name AND
        c.data_type IN('float', 'int', 'bigint')
    )
  LIMIT 1
;`;
    return query;
  }

  buildTableConstraint() {
    const table = (this.target as any).table;
    let query = '';

    // check for schema qualified table
    if (table.includes('.')) {
      const parts = table.split('.');
      query = 'table_schema = ' + this.quoteIdentAsLiteral(parts[0]);
      query += ' AND table_name = ' + this.quoteIdentAsLiteral(parts[1]);
      return query;
    } else {
      query = 'table_schema = database() AND table_name = ' + this.quoteIdentAsLiteral(table);

      return query;
    }
  }

  buildTableQuery() {
    return 'SELECT table_name FROM information_schema.tables WHERE table_schema = database() ORDER BY table_name';
  }

  buildColumnQuery(type?: string) {
    const timeColumn = (this.target as any).timeColumn;
    let query = 'SELECT column_name FROM information_schema.columns WHERE ';
    query += this.buildTableConstraint();

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
        query += ' AND column_name <> ' + this.quoteIdentAsLiteral(timeColumn);
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

  buildValueQuery(column: string) {
    const timeColumn = (this.target as any).timeColumn;
    let query = 'SELECT DISTINCT QUOTE(' + column + ')';
    query += ' FROM ' + (this.target as any).table;
    query += ' WHERE $__timeFilter(' + timeColumn + ')';
    query += ' ORDER BY 1 LIMIT 100';
    return query;
  }

  buildDatatypeQuery(column: string) {
    let query = `
SELECT data_type
FROM information_schema.columns
WHERE `;
    query += ' table_name = ' + this.quoteIdentAsLiteral((this.target as any).table);
    query += ' AND column_name = ' + this.quoteIdentAsLiteral(column);
    return query;
  }
}
