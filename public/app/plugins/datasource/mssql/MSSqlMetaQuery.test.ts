import { getSchema } from './MSSqlMetaQuery';

describe('getSchema', () => {
  const database = 'foo';
  const table = 'bar';
  const schema = getSchema(database, table);
  it('should escapte database names', () => {
    expect(schema).toContain(`USE [${database}]`);
  });
});
