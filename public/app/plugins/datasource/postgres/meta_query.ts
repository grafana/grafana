export class PostgresMetaQuery {
  constructor(private target, private queryModel) {}

  // quote identifier as literal to use in metadata queries
  quoteIdentAsLiteral(value) {
    return this.queryModel.quoteLiteral(this.queryModel.unquoteIdentifier(value));
  }

  buildSchemaQuery() {
    let query = 'SELECT quote_ident(schema_name) FROM information_schema.schemata WHERE';
    query += " schema_name NOT LIKE 'pg_%' AND schema_name NOT LIKE '\\_%' AND schema_name <> 'information_schema';";

    return query;
  }

  buildTableQuery() {
    let query = 'SELECT quote_ident(table_name) FROM information_schema.tables WHERE ';
    query += 'table_schema = ' + this.quoteIdentAsLiteral(this.target.schema);
    return query;
  }

  buildColumnQuery(type?: string) {
    let query = 'SELECT quote_ident(column_name) FROM information_schema.columns WHERE ';
    query += 'table_schema = ' + this.quoteIdentAsLiteral(this.target.schema);
    query += ' AND table_name = ' + this.quoteIdentAsLiteral(this.target.table);

    switch (type) {
      case 'time': {
        query +=
          " AND data_type IN ('timestamp without time zone','timestamp with time zone','bigint','integer','double precision','real')";
        break;
      }
      case 'metric': {
        query += " AND data_type IN ('text','char','varchar')";
        break;
      }
      case 'value': {
        query += " AND data_type IN ('bigint','integer','double precision','real')";
        query += ' AND column_name <> ' + this.quoteIdentAsLiteral(this.target.timeColumn);
        break;
      }
      case 'groupby': {
        query += " AND data_type IN ('text','char','varchar')";
        break;
      }
    }

    return query;
  }

  buildValueQuery(column: string) {
    let query = 'SELECT DISTINCT quote_literal(' + column + ')';
    query += ' FROM ' + this.target.schema + '.' + this.target.table;
    query += ' WHERE $__timeFilter(' + this.target.timeColumn + ')';
    query += ' ORDER BY 1 LIMIT 100';
    return query;
  }

  buildDatatypeQuery(column: string) {
    let query = 'SELECT data_type FROM information_schema.columns WHERE ';
    query += ' table_schema = ' + this.quoteIdentAsLiteral(this.target.schema);
    query += ' AND table_name = ' + this.quoteIdentAsLiteral(this.target.table);
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
