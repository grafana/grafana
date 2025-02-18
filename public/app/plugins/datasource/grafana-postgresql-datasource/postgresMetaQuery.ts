export function getVersion() {
  return "SELECT current_setting('server_version_num')::int/100 as version";
}

export function getTimescaleDBVersion() {
  return "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'";
}

export function showTables() {
  return `SELECT
    CASE WHEN ${buildSchemaConstraint()}
      THEN quote_ident(table_name)
      ELSE quote_ident(table_schema) || '.' || quote_ident(table_name)
    END AS "table"
    FROM information_schema.tables
    WHERE quote_ident(table_schema) NOT IN ('information_schema',
                             'pg_catalog',
                             '_timescaledb_cache',
                             '_timescaledb_catalog',
                             '_timescaledb_internal',
                             '_timescaledb_config',
                             'timescaledb_information',
                             'timescaledb_experimental')
    ORDER BY CASE WHEN ${buildSchemaConstraint()} THEN 0 ELSE 1 END, 1`;
}

export function getSchema(table: string) {
  // we will put table-name between single-quotes, so we need to escape single-quotes
  // in the table-name
  const tableNamePart = "'" + table.replace(/'/g, "''") + "'";

  return `SELECT quote_ident(column_name) AS "column", data_type AS "type"
    FROM information_schema.columns
    WHERE
      CASE WHEN array_length(parse_ident(${tableNamePart}),1) = 2
        THEN quote_ident(table_schema) = (parse_ident(${tableNamePart}))[1]
          AND quote_ident(table_name) = (parse_ident(${tableNamePart}))[2]
        ELSE quote_ident(table_name) = ${tableNamePart}
          AND ${buildSchemaConstraint()}
      END`;
}

function buildSchemaConstraint() {
  // quote_ident protects hyphenated schemes
  return `
          quote_ident(table_schema) IN (
          SELECT
            CASE WHEN trim(s[i]) = '"$user"' THEN user ELSE trim(s[i]) END
          FROM
            generate_series(
              array_lower(string_to_array(current_setting('search_path'),','),1),
              array_upper(string_to_array(current_setting('search_path'),','),1)
            ) as i,
            string_to_array(current_setting('search_path'),',') s
          )`;
}
