import { ObjectVariable } from './ObjectVariable';

describe('ObjectVariable', () => {
  describe('getValue', () => {
    it('it should return value according to fieldPath', () => {
      const variable = new ObjectVariable({
        name: 'test',
        value: {
          field1: 'value1',
          array: ['value1', 'value2', 'value3'],
        },
      });

      expect(variable.getValue('field1')).toBe('value1');
      expect(variable.getValue('array[1]')).toBe('value2');
    });
  });
});
