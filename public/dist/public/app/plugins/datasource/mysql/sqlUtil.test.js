import { isValidIdentifier } from './sqlUtil';
describe('isValidIdentifier', () => {
    test.each([
        { value: 'and', expected: false },
        { value: '1name', expected: false },
        { value: 'my-sql', expected: false },
        { value: '$id', expected: false },
        { value: 'my sql', expected: false },
        { value: 'mysql ', expected: false },
        { value: ' mysql', expected: false },
        { value: 'id$', expected: true },
        { value: 'myIdentifier', expected: true },
        { value: 'table_name', expected: true },
    ])('should return $expected when value is $value', ({ value, expected }) => {
        expect(isValidIdentifier(value)).toBe(expected);
    });
});
//# sourceMappingURL=sqlUtil.test.js.map