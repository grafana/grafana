
export class VerticaMetaQuery {
  constructor(private target, private queryModel) {}

  getOperators(datatype: string) {
    switch (datatype) {
      case 'float4':
      case 'float8': {
        return ['=', '!=', '<', '<=', '>', '>='];
      }
      case 'text':
      case 'varchar':
      case 'char': {
        return ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN', 'LIKE', 'NOT LIKE', '~', '~*', '!~', '!~*'];
      }
      default: {
        return ['=', '!=', '<', '<=', '>', '>=', 'IN', 'NOT IN'];
      }
    }
  }

  // quote identifier as literal to use in metadata queries
  quoteIdentAsLiteral(value) {
    return this.queryModel.quoteLiteral(this.queryModel.unquoteIdentifier(value));
  }

  getSchemaQuerySQL() {
    return `SELECT DISTINCT(schema_name) FROM v_catalog.all_tables ORDER BY 1`;
  }

  getFindMetricTableSQL() {
    // query that returns first table found that has a timestamp(tz) column and a float column

    // let query = `
    // SELECT
    // 	QUOTE_IDENT(table_name) as table_name,
    // 	( SELECT
    //     QUOTE_IDENT(column_name) as column_name
    // 	  FROM v_catalog.columns c
    //     WHERE
    //       c.table_schema = t.table_schema AND
    //       c.table_name = t.table_name AND
    //       c.data_type IN ('timestamp','timestamptz')
    //     ORDER BY ordinal_position LIMIT 1
    //   ) AS time_column,
    //   ( SELECT
    //     QUOTE_IDENT(column_name) AS column_name
    //     FROM v_catalog.columns c
    //     WHERE
    //       c.table_schema = t.table_schema AND
    //       c.table_name = t.table_name AND
    //       c.data_type = 'float'
    //     ORDER BY ordinal_position LIMIT 1
    //   ) AS value_column
    // FROM v_catalog.tables t
    // WHERE `;
    //     query += this.getSchemaConstraintSQL();
    //     query += ` AND
    //   EXISTS
    //   ( SELECT 1
    //     FROM v_catalog.columns c
    //     WHERE
    //       c.table_schema = t.table_schema AND
    //       c.table_name = t.table_name AND
    //       c.data_type IN ('timestamp','timestamptz')
    //   ) AND
    //   EXISTS
    //   ( SELECT 1
    //     FROM v_catalog.columns c
    //     WHERE
    //       c.table_schema = t.table_schema AND
    //       c.table_name = t.table_name AND
    //       c.data_type = 'float'
    //   )
    // LIMIT 1;
    // `;

    const query = `
    SELECT
    	QUOTE_IDENT(table_name) as table_name,
    	( SELECT
        QUOTE_IDENT(column_name) as column_name
    	  FROM v_catalog.columns c
        WHERE
          c.table_schema = t.table_schema AND
          c.table_name = t.table_name AND
          c.data_type IN ('timestamp','timestamptz')
        ORDER BY ordinal_position LIMIT 1
      ) AS time_column,
      ( SELECT
        QUOTE_IDENT(column_name) AS column_name
        FROM v_catalog.columns c
        WHERE
          c.table_schema = t.table_schema AND
          c.table_name = t.table_name AND
          c.data_type = 'float'
        ORDER BY ordinal_position LIMIT 1
      ) AS value_column
    FROM v_catalog.tables t
    `;
    //    query += this.getSchemaConstraintSQL();
        // query += " LIMIT 1";
    //     query += ` AND
    //   EXISTS
    //   ( SELECT 1
    //     FROM v_catalog.columns c
    //     WHERE
    //       c.table_schema = t.table_schema AND
    //       c.table_name = t.table_name AND
    //       c.data_type IN ('timestamp','timestamptz')
    //   ) AND
    //   EXISTS
    //   ( SELECT 1
    //     FROM v_catalog.columns c
    //     WHERE
    //       c.table_schema = t.table_schema AND
    //       c.table_name = t.table_name AND
    //       c.data_type = 'float'
    //   )
    // LIMIT 1;
    // `;


    return query;
  }

// getSchemaConstraintSQL() {
//   return " table_schema = 'public' ";
//     const query = `
// table_schema IN (
//   SELECT
//     CASE WHEN trim(s[i]) = '"$user"' THEN user ELSE trim(s[i]) END
//   FROM
//     generate_series(
//       array_lower(string_to_array(current_setting('search_path'),','),1),
//       array_upper(string_to_array(current_setting('search_path'),','),1)
//     ) as i,
//     string_to_array(current_setting('search_path'),',') s
// )`;
//     return query;
//}

  getTableConstraintSQL(table: string) {
    let query = '';

    // check for schema qualified table
    if (table.includes('.')) {
      const parts = table.split('.');
      query = 'table_schema = ' + this.quoteIdentAsLiteral(parts[0]);
      query += ' AND table_name = ' + this.quoteIdentAsLiteral(parts[1]);
      return query;
    } else {
      // query = this.buildSchemaConstraint();
      query = 'table_schema = ' + this.quoteIdentAsLiteral('public');
      query += ' AND table_name = ' + this.quoteIdentAsLiteral(table);
      return query;
    }
  }

  getTableQuerySQL(schema: string) {
    return "SELECT QUOTE_IDENT(table_name) AS table_name FROM v_catalog.all_tables WHERE schema_name='" +
      schema + "' ORDER BY table_name";
  }

  getColumnQuerySQL(type?: string) {

    let query = `
      SELECT QUOTE_IDENT(column_name) as column_name FROM
        (select data_type, column_name, table_name, table_schema, data_type_id from v_catalog.columns UNION
         select data_type, column_name, table_name, table_schema, data_type_id from v_catalog.system_columns) AS a WHERE `;

    query += this.getTableConstraintSQL(this.target.table);

    switch (type) {
      case 'time': {
        query +=
          " AND a.data_type IN ('timestamp','timestamptz')";
          break;
      }
      case 'metric': {
        query += " AND a.data_type_id IN (9, 115)";
        break;
      }
      case 'value': {
        query += " AND a.data_type IN ('float', 'int') AND a.column_name<>" + this.quoteIdentAsLiteral(this.target.timeColumn);
        break;
      }
      case 'group': {
        query += " AND a.data_type_id IN (9, 115)";
        break;
      }
    }

    query += ' ORDER BY a.column_name';

    return query;
  }

  buildValueQuery(column: string) {
    let query = 'SELECT DISTINCT QUOTE_LITERAL(' + column + ')';
    query += ' FROM ' + this.target.table;
    query += ' WHERE $__timeFilter(' + this.target.timeColumn + ')';
    query += ' AND ' + column + ' IS NOT NULL';
    query += ' ORDER BY 1 LIMIT 100';
    return query;
  }

  buildDatatypeQuery(column: string) {
    let query = 'SELECT data_type FROM v_catalog.columns WHERE ';
    query += this.getTableConstraintSQL(this.target.table);
    query += ' AND column_name = ' + this.quoteIdentAsLiteral(column);
    return query;
  }

  buildAggregateQuery() {
    let query = 'SELECT DISTINCT proname FROM pg_aggregate ';
    query += 'INNER JOIN pg_proc ON pg_aggregate.aggfnoid = pg_proc.oid ';
    query += 'INNER JOIN pg_type ON pg_type.oid=pg_proc.prorettype ';
    query += "WHERE pronargs=1 AND typname IN ('float8') AND aggkind='n' ORDER BY 1";
    return query;
  }
}
