import { extractCommonLabels, Label, omitLabels } from './common';

test('extractCommonLabels', () => {
  const labels: Label[][] = [
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
  const labels: Label[][] = [[['foo', 'bar']], [['potato', 'tomato']]];

  expect(extractCommonLabels(labels)).toStrictEqual([]);
});

test('omitLabels', () => {
  const labels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
    ['potato', 'tomato'],
  ];
  const commonLabels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
  ];

  expect(omitLabels(labels, commonLabels)).toStrictEqual([['potato', 'tomato']]);
});

test('omitLabels with no common labels', () => {
  const labels: Label[] = [['potato', 'tomato']];
  const commonLabels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
  ];

  expect(omitLabels(labels, commonLabels)).toStrictEqual(labels);
});
