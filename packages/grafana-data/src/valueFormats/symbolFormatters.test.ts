import { currency } from './symbolFormatters';

describe('currency', () => {
  const symbol = '@';

  describe('when called without asSuffix', () => {
    const fmtFunc = currency(symbol);

    it.each`
      value               | expectedSuffix | expectedText
      ${999}              | ${''}          | ${'999'}
      ${1000}             | ${'K'}         | ${'1'}
      ${1000000}          | ${'M'}         | ${'1'}
      ${1000000000}       | ${'B'}         | ${'1'}
      ${1000000000000}    | ${'T'}         | ${'1'}
      ${1000000000000000} | ${undefined}   | ${'NA'}
      ${-1000000000000}   | ${'T'}         | ${'-1'}
      ${-1000000000}      | ${'B'}         | ${'-1'}
      ${-1000000}         | ${'M'}         | ${'-1'}
      ${-1000}            | ${'K'}         | ${'-1'}
      ${-999}             | ${''}          | ${'-999'}
    `('when called with value:{$value}', ({ value, expectedSuffix, expectedText }) => {
      const { prefix, suffix, text } = fmtFunc(value);

      expect(prefix).toEqual(symbol);
      expect(suffix).toEqual(expectedSuffix);
      expect(text).toEqual(expectedText);
    });
  });

  describe('when called with asSuffix', () => {
    const fmtFunc = currency(symbol, true);

    it.each`
      value               | expectedSuffix | expectedText
      ${999}              | ${'@'}         | ${'999'}
      ${1000}             | ${'K@'}        | ${'1'}
      ${1000000}          | ${'M@'}        | ${'1'}
      ${1000000000}       | ${'B@'}        | ${'1'}
      ${1000000000000}    | ${'T@'}        | ${'1'}
      ${1000000000000000} | ${undefined}   | ${'NA'}
      ${-1000000000000}   | ${'T@'}        | ${'-1'}
      ${-1000000000}      | ${'B@'}        | ${'-1'}
      ${-1000000}         | ${'M@'}        | ${'-1'}
      ${-1000}            | ${'K@'}        | ${'-1'}
      ${-999}             | ${'@'}         | ${'-999'}
    `('when called with value:{$value}', ({ value, expectedSuffix, expectedText }) => {
      const { prefix, suffix, text } = fmtFunc(value);

      expect(prefix).toEqual(undefined);
      expect(suffix).toEqual(expectedSuffix);
      expect(text).toEqual(expectedText);
    });
  });
});
