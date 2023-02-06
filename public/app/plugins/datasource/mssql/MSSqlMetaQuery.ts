export function showDatabases() {
  // Return only user defined databases
  return `SELECT name FROM sys.databases WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb');`;
}

export function getSchemaAndName(database?: string) {
  return `SELECT TABLE_SCHEMA + '.' + TABLE_NAME as schemaAndName
    FROM [${database}].INFORMATION_SCHEMA.TABLES`;
}

export function getSchema(database?: string, table?: string) {
  return `
   USE ${database}
   SELECT COLUMN_NAME as 'column',DATA_TYPE as 'type'
   FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}';`;
}
