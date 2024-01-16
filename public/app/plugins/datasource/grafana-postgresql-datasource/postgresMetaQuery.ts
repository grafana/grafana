export function getVersion() {
  return "SELECT current_setting('server_version_num')::int/100 as version";
}

export function getTimescaleDBVersion() {
  return "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'";
}

export function showTables() {
  return `select quote_ident(table_name) as "table" from information_schema.tables
    where quote_ident(table_schema) not in ('information_schema',
                             'pg_catalog',
                             '_timescaledb_cache',
                             '_timescaledb_catalog',
                             '_timescaledb_internal',
                             '_timescaledb_config',
                             'timescaledb_information',
                             'timescaledb_experimental')
      and ${buildSchemaConstraint()}`;
}

export function getSchema(table?: string) {
  return `select quote_ident(column_name) as "column", data_type as "type"
    from information_schema.columns
    where quote_ident(table_name) = '${table}'`;
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
