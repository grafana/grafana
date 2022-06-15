import { SelectableValue } from '@grafana/data';

import { SelectableOptGroup } from './types';
import { cleanValue, findSelectedValue } from './utils';

const optGroup: SelectableOptGroup[] = [
  {
    label: 'Group 1',
    options: [
      { label: 'Group 1 - Option 1', value: 1 },
      { label: 'Group 1 - Option 2', value: 2 },
    ],
  },
  {
    label: 'Group 2',
    options: [
      { label: 'Group 2 - Option 1', value: 11 },
      { label: 'Group 2 - Option 2', value: 12 },
    ],
  },
  {
    label: 'Group 3',
    options: [
      { label: 'Group 4 - Option 1', value: 'test1' },
      { label: 'Group 4 - Option 2', value: 'test2' },
    ],
  },
  {
    label: 'Group 4',
    options: [
      { label: 'Group 4 - Option 1', value: 'test3' },
      { label: 'Group 4 - Option 2', value: 'test4' },
    ],
  },
];

const options: SelectableValue[] = [
  { label: 'Option 1', value: 1 },
  { label: ' Option 2', value: 'test2' },
  { label: 'Option 3', value: 3 },
  { label: 'Option 4', value: 4 },
  { label: 'Option 5', value: 'test5' },
  { label: 'Option 6', value: 6 },
];

describe('Select utils', () => {
  describe('findSelected value', () => {
    it('should find value of type number in array of optgroups', () => {
      expect(findSelectedValue(11, optGroup)).toEqual({ label: 'Group 2 - Option 1', value: 11 });
    });

    it('should find value of type string in array of optgroups', () => {
      expect(findSelectedValue('test3', optGroup)).toEqual({ label: 'Group 4 - Option 1', value: 'test3' });
    });

    it('should find the value of type number in array of options', () => {
      expect(findSelectedValue(3, options)).toEqual({ label: 'Option 3', value: 3 });
    });
    it('should find the value of type string in array of options', () => {
      expect(findSelectedValue('test5', options)).toEqual({ label: 'Option 5', value: 'test5' });
    });
  });

  describe('cleanValue', () => {
    it('should return filtered array of values for value of array type', () => {
      const value = [null, { value: 'test', label: 'Test' }, undefined, undefined];
      expect(cleanValue(value, options)).toEqual([{ value: 'test', label: 'Test' }]);
    });

    it('should return array when value is a single object', () => {
      expect(cleanValue({ value: 'test', label: 'Test' }, options)).toEqual([{ value: 'test', label: 'Test' }]);
    });

    it('should return correct value when value argument is a string', () => {
      expect(cleanValue('test1', optGroup)).toEqual([{ label: 'Group 4 - Option 1', value: 'test1' }]);
      expect(cleanValue(3, options)).toEqual([{ label: 'Option 3', value: 3 }]);
    });

    it('should return null for null values', () => {
      expect(cleanValue(null, options)).toEqual([null]);
    });

    it('should return undefined for undefined/empty values', () => {
      expect(cleanValue([undefined], options)).toEqual(undefined);
      expect(cleanValue(undefined, options)).toEqual(undefined);
      expect(cleanValue('', options)).toEqual(undefined);
    });
  });
});
