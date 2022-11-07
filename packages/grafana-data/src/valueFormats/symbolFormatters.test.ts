import { currency, SIPrefix } from './symbolFormatters';

describe('currency', () => {
  const symbol = '@';

  describe('when called without asSuffix', () => {
    const fmtFunc = currency(symbol);

    it.each`
      value               | expectedSuffix | expectedText
      ${0}                | ${''}          | ${'0'}
      ${999}              | ${''}          | ${'999'}
      ${1000}             | ${'K'}         | ${'1'}
      ${1000000}          | ${'M'}         | ${'1'}
      ${1000000000}       | ${'B'}         | ${'1'}
      ${1000000000000}    | ${'T'}         | ${'1'}
      ${1000000000000000} | ${'T'}         | ${'1000'}
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
      ${0}                | ${'@'}         | ${'0'}
      ${999}              | ${'@'}         | ${'999'}
      ${1000}             | ${'K@'}        | ${'1'}
      ${1000000}          | ${'M@'}        | ${'1'}
      ${1000000000}       | ${'B@'}        | ${'1'}
      ${1000000000000}    | ${'T@'}        | ${'1'}
      ${1000000000000000} | ${'T@'}        | ${'1000'}
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

describe('SIPrefix', () => {
  const symbol = 'V';
  const fmtFunc = SIPrefix(symbol);

  it.each`
    value               | expectedSuffix | expectedText
    ${0}                | ${' V'}        | ${'0'}
    ${999}              | ${' V'}        | ${'999'}
    ${1000}             | ${' kV'}       | ${'1'}
    ${1000000}          | ${' MV'}       | ${'1'}
    ${1000000000}       | ${' GV'}       | ${'1'}
    ${1000000000000}    | ${' TV'}       | ${'1'}
    ${1000000000000000} | ${' PV'}       | ${'1'}
    ${-1000000000000}   | ${' TV'}       | ${'-1'}
    ${-1000000000}      | ${' GV'}       | ${'-1'}
    ${-1000000}         | ${' MV'}       | ${'-1'}
    ${-1000}            | ${' kV'}       | ${'-1'}
    ${-999}             | ${' V'}        | ${'-999'}
  `('when called with value:{$value}', ({ value, expectedSuffix, expectedText }) => {
    const { prefix, suffix, text } = fmtFunc(value);

    expect(prefix).toEqual(undefined);
    expect(suffix).toEqual(expectedSuffix);
    expect(text).toEqual(expectedText);
  });
});
