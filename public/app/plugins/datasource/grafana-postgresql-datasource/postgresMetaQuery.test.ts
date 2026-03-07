import { getSchema, showSchemas, showTables } from './postgresMetaQuery';

describe('postgredsMetaQuery.getSchema', () => {
  it('should handle table-names with single quote', () => {
    // testing multi-line with single-quote, double-quote, backtick
    const tableName = `'a''bcd'efg'h'  "a""b" ` + '`x``y`z' + `\n a'b''c`;
    const escapedName = `''a''''bcd''efg''h''  "a""b" ` + '`x``y`z' + `\n a''b''''c`;

    const schemaQuery = getSchema(tableName);

    expect(schemaQuery.includes(escapedName)).toBeTruthy();
    expect(schemaQuery.includes(tableName)).toBeFalsy();
  });
});

describe('showSchemas', () => {
  it('should return a query that selects schema names', () => {
    const query = showSchemas();
    expect(query).toContain('information_schema.schemata');
    expect(query).toContain('schema_name AS "name"');
  });

  it('should filter out system schemas', () => {
    const query = showSchemas();
    expect(query).toContain('pg_catalog');
    expect(query).toContain('pg_toast');
    expect(query).toContain('information_schema');
  });
});

describe('showTables', () => {
  it('should return all tables when no schema is provided', () => {
    const query = showTables();
    expect(query).toContain('information_schema.tables');
    expect(query).toContain('quote_ident(table_schema)');
  });

  it('should filter tables by schema when schema is provided', () => {
    const query = showTables('sales');
    expect(query).toContain("quote_ident(table_schema) = 'sales'");
  });

  it('should escape single quotes in schema name', () => {
    const query = showTables("test'schema");
    expect(query).toContain("'test''schema'");
  });
});
