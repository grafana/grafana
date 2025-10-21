import { isValidIdentifier } from './sqlUtil';
import { toRawSql } from './sqlUtil';

describe('isValidIdentifier', () => {
  test.each([
    { value: 'and', expected: false }, // Reserved keyword
    { value: '1name', expected: false }, // Starts with value
    { value: 'my-sql', expected: false }, // Contains not permitted character
    { value: '$id', expected: false }, // $ sign shouldn't be the first character
    { value: 'my sql', expected: false }, // Whitespace is not permitted
    { value: 'mysql ', expected: false }, // Whitespace is not permitted at the end
    { value: ' mysql', expected: false }, // Whitespace is not permitted
    { value: 'id$', expected: true },
    { value: 'myIdentifier', expected: true },
    { value: 'table_name', expected: true },
  ])('should return $expected when value is $value', ({ value, expected }) => {
    expect(isValidIdentifier(value)).toBe(expected);
  });
});

describe('toRawSql', () => {
  it('quotes dataset and table identifiers when they contain prohibited characters', () => {
    const query = {
      sql: { columns: [{ type: 'column', name: '*' } as any] },
      dataset: 'se-backoffice',
      table: 'action_title',
    } as any;

    const result = toRawSql(query);
    // dataset contains a hyphen and should be backticked
    expect(result).toContain('FROM `se-backoffice`.action_title');
  });
});
