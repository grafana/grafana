import { getSchema } from './postgresMetaQuery';

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
