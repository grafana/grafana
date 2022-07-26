export function getVersion() {
  return "SELECT current_setting('server_version_num')::int/100 as version";
}

export function getTimescaleDBVersion() {
  return "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'";
}

export function showDatabases() {
  return 'SELECT datname FROM pg_database WHERE datistemplate = false';
}

export function showTables() {
  return `select table_name from information_schema.tables
    where table_schema not in ('information_schema',
                             'pg_catalog',
                             '_timescaledb_cache',
                             '_timescaledb_catalog',
                             '_timescaledb_internal',
                             '_timescaledb_config',
                             'timescaledb_information',
                             'timescaledb_experimental')
      and table_type = 'BASE TABLE'`;
}

export function getSchema(table?: string) {
  return `select column_name as "column", data_type as "type"
    from information_schema.columns
    where table_name = '${table}'`;
}
