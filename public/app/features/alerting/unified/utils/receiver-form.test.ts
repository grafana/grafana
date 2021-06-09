import { omitEmptyValues } from './receiver-form';

describe('Receiver form utils', () => {
  describe('omitEmptyStringValues', () => {
    it('should recursively omit empty strings but leave other properties in palce', () => {
      const original = {
        one: 'two',
        remove: '',
        three: 0,
        four: null,
        five: [
          [
            {
              foo: 'bar',
              remove: '',
              notDefined: undefined,
            },
          ],
          {
            foo: 'bar',
            remove: '',
          },
        ],
      };

      const expected = {
        one: 'two',
        three: 0,
        five: [
          [
            {
              foo: 'bar',
            },
          ],
          {
            foo: 'bar',
          },
        ],
      };

      expect(omitEmptyValues(original)).toEqual(expected);
    });
  });
});
