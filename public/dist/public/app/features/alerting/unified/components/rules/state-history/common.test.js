import { extractCommonLabels, omitLabels } from './common';
test('extractCommonLabels', () => {
    const labels = [
        [
            ['foo', 'bar'],
            ['baz', 'qux'],
        ],
        [
            ['foo', 'bar'],
            ['baz', 'qux'],
            ['potato', 'tomato'],
        ],
    ];
    expect(extractCommonLabels(labels)).toStrictEqual([
        ['foo', 'bar'],
        ['baz', 'qux'],
    ]);
});
test('extractCommonLabels with no common labels', () => {
    const labels = [[['foo', 'bar']], [['potato', 'tomato']]];
    expect(extractCommonLabels(labels)).toStrictEqual([]);
});
test('omitLabels', () => {
    const labels = [
        ['foo', 'bar'],
        ['baz', 'qux'],
        ['potato', 'tomato'],
    ];
    const commonLabels = [
        ['foo', 'bar'],
        ['baz', 'qux'],
    ];
    expect(omitLabels(labels, commonLabels)).toStrictEqual([['potato', 'tomato']]);
});
test('omitLabels with no common labels', () => {
    const labels = [['potato', 'tomato']];
    const commonLabels = [
        ['foo', 'bar'],
        ['baz', 'qux'],
    ];
    expect(omitLabels(labels, commonLabels)).toStrictEqual(labels);
});
//# sourceMappingURL=common.test.js.map