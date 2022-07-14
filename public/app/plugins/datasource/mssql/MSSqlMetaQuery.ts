export function showDatabases() {
  // Return only user defined databases
  return `SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb');`;
}

export function showTables(dataset?: string) {
  return `SELECT TABLE_NAME as name
    FROM [${dataset}].INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'`;
}

export function getSchema(table?: string) {
  return `SELECT COLUMN_NAME as 'column',DATA_TYPE as 'type'
   FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}';`;
}
