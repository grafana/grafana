import { customBuilder } from '../variables/shared/testing/builders';

import { FormatRegistryID, formatRegistry } from './formatRegistry';

const dummyVar = customBuilder().withId('variable').build();
describe('formatRegistry', () => {
  describe('with lucene formatter', () => {
    const { formatter } = formatRegistry.get(FormatRegistryID.lucene);

    it('should escape single value', () => {
      expect(
        formatter(
          {
            value: 'foo bar',
            text: '',
            args: [],
          },
          dummyVar
        )
      ).toBe('foo\\ bar');
    });

    it('should not escape negative number', () => {
      expect(
        formatter(
          {
            value: '-1',
            text: '',
            args: [],
          },
          dummyVar
        )
      ).toBe('-1');
    });

    it('should escape string prepended with dash', () => {
      expect(
        formatter(
          {
            value: '-test',
            text: '',
            args: [],
          },
          dummyVar
        )
      ).toBe('\\-test');
    });

    it('should escape multi value', () => {
      expect(
        formatter(
          {
            value: ['foo bar', 'baz'],
            text: '',
            args: [],
          },
          dummyVar
        )
      ).toBe('("foo\\ bar" OR "baz")');
    });

    it('should escape empty value', () => {
      expect(
        formatter(
          {
            value: [],
            text: '',
            args: [],
          },
          dummyVar
        )
      ).toBe('__empty__');
    });
  });
});
