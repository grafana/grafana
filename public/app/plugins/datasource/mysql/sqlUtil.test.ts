import { isValidIdentifier } from './sqlUtil';

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
