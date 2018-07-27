export class PostgresMetaQuery {
  constructor(private target, private queryModel) {}

  // quote identifier as literal to use in metadata queries
  quoteIdentAsLiteral(value) {
    return this.queryModel.quoteLiteral(this.queryModel.unquoteIdentifier(value));
  }

  findMetricTable() {
    // query that returns first table found that has a timestamptz column and a float column
    let query = `
SELECT
	table_name,
	( SELECT
	    column_name
	  FROM information_schema.columns c
    WHERE
      c.table_schema = t.table_schema AND
      c.table_name = t.table_name AND
      udt_name IN ('timestamptz','timestamp')
    ORDER BY ordinal_position LIMIT 1
  ) AS time_column,
  ( SELECT
      column_name
    FROM information_schema.columns c
    WHERE
      c.table_schema = t.table_schema AND
      c.table_name = t.table_name AND
      udt_name='float8'
    ORDER BY ordinal_position LIMIT 1
  ) AS value_column
FROM information_schema.tables t
WHERE
  table_schema IN (
		SELECT CASE WHEN trim(unnest) = \'"$user"\' THEN user ELSE trim(unnest) END
    FROM unnest(string_to_array(current_setting(\'search_path\'),\',\'))
  ) AND
  EXISTS
  ( SELECT 1
    FROM information_schema.columns c
    WHERE
      c.table_schema = t.table_schema AND
      c.table_name = t.table_name AND
      udt_name IN ('timestamptz','timestamp')
  )
  ( SELECT 1
    FROM information_schema.columns c
    WHERE
      c.table_schema = t.table_schema AND
      c.table_name = t.table_name AND
      udt_name='float8'
  )
LIMIT 1
;`;
    return query;
  }

  buildTableQuery() {
    let query = `
SELECT quote_ident(table_name)
FROM information_schema.tables
WHERE
  table_schema IN (
		SELECT CASE WHEN trim(unnest) = \'"$user"\' THEN user ELSE trim(unnest) END
    FROM unnest(string_to_array(current_setting(\'search_path\'),\',\'))
  )
ORDER BY table_name`;
    return query;
  }

  buildColumnQuery(type?: string) {
    let query = `
SELECT quote_ident(column_name)
FROM information_schema.columns
WHERE
  table_schema IN (
		SELECT CASE WHEN trim(unnest) = \'"$user"\' THEN user ELSE trim(unnest) END
    FROM unnest(string_to_array(current_setting(\'search_path\'),\',\'))
    LIMIT 1
  )
`;
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

    query += ' ORDER BY column_name';

    return query;
  }

  buildValueQuery(column: string) {
    let query = 'SELECT DISTINCT quote_literal(' + column + ')';
    query += ' FROM ' + this.target.table;
    query += ' WHERE $__timeFilter(' + this.target.timeColumn + ')';
    query += ' ORDER BY 1 LIMIT 100';
    return query;
  }

  buildDatatypeQuery(column: string) {
    let query = `
SELECT data_type
FROM information_schema.columns
WHERE
  table_schema IN (
		SELECT CASE WHEN trim(unnest) = \'"$user"\' THEN user ELSE trim(unnest) END
    FROM unnest(string_to_array(current_setting(\'search_path\'),\',\'))
    LIMIT 1
  )
`;
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
