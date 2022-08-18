import { SortOrder } from '@grafana/schema';

import { sortValues } from './arrayUtils';

describe('arrayUtils', () => {
  describe('sortValues', () => {
    const testArrayNumeric = [1, 10, null, 2, undefined, 5, 6, ' ', 7, 9, 8, 3, 4];
    const testArrayString = ['1', '10', null, '2', undefined, '5', '6', ' ', '7', '9', '8', '3', '4'];
    const testArrayFloatingPoint = ['1.0', '2.7', '0.5', ' ', null, '2', undefined];
    const testArrayVariableFloatingPoint = [1.1234567, 2.7, 1.23456, ' ', null, 2, undefined];
    const testArrayText = ['baz', ' ', 'foo', null, 'bar', undefined];
    const testArrayMixed = ['baz', ' ', 1, 'foo', '1.5', '0.5', null, 'bar', undefined];

    it.each`
      order                   | testArray                         | expected
      ${SortOrder.Ascending}  | ${testArrayNumeric}               | ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ' ', null, undefined]}
      ${SortOrder.Descending} | ${testArrayNumeric}               | ${[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, ' ', null, undefined]}
      ${SortOrder.Ascending}  | ${testArrayString}                | ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', ' ', null, undefined]}
      ${SortOrder.Descending} | ${testArrayString}                | ${['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', ' ', null, undefined]}
      ${SortOrder.Ascending}  | ${testArrayFloatingPoint}         | ${['0.5', '1.0', '2', '2.7', null, ' ', undefined]}
      ${SortOrder.Descending} | ${testArrayFloatingPoint}         | ${['2.7', '2', '1.0', '0.5', null, ' ', undefined]}
      ${SortOrder.Ascending}  | ${testArrayText}                  | ${['bar', 'baz', 'foo', null, ' ', undefined]}
      ${SortOrder.Descending} | ${testArrayText}                  | ${['foo', 'baz', 'bar', null, ' ', undefined]}
      ${SortOrder.Ascending}  | ${testArrayMixed}                 | ${['0.5', 1, '1.5', 'bar', 'baz', 'foo', null, ' ', undefined]}
      ${SortOrder.Descending} | ${testArrayMixed}                 | ${['foo', 'baz', 'bar', '1.5', 1, '0.5', null, ' ', undefined]}
      ${SortOrder.Ascending}  | ${testArrayVariableFloatingPoint} | ${[1.1234567, 1.23456, 2, 2.7, null, ' ', undefined]}
      ${SortOrder.Descending} | ${testArrayVariableFloatingPoint} | ${[2.7, 2, 1.23456, 1.1234567, null, ' ', undefined]}
    `('$order', ({ order, testArray, expected }) => {
      const sorted = [...testArray].sort(sortValues(order));
      expect(sorted).toEqual(expected);
    });
  });
});
