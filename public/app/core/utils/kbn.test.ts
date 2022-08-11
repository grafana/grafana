import { DecimalCount, TimeZone } from '@grafana/data';

import kbn from './kbn';

// Most of the methods in this file are deprecated
// Stub the deprecation warning here to prevent polluting the test output
jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  deprecationWarning: () => {},
}));

interface ValueFormatTest {
  id: string;
  decimals?: DecimalCount;
  timeZone?: TimeZone;
  value: number;
  result: string;
}

const formatTests: ValueFormatTest[] = [
  // Currency
  { id: 'currencyUSD', decimals: 2, value: 1532.82, result: '$1.53K' },
  { id: 'currencyKRW', decimals: 2, value: 1532.82, result: '₩1.53K' },
  { id: 'currencyIDR', decimals: 2, value: 1532.82, result: 'Rp1.53K' },

  // Typical
  { id: 'ms', decimals: 4, value: 0.0024, result: '0.0024 ms' },
  { id: 'ms', decimals: 0, value: 100, result: '100 ms' },
  { id: 'ms', decimals: 2, value: 1250, result: '1.25 s' },
  { id: 'ms', decimals: 1, value: 10000086.123, result: '2.8 hour' },
  { id: 'ms', decimals: 0, value: 1200, result: '1 s' },
  { id: 'short', decimals: 0, value: 98765, result: '99 K' },
  { id: 'short', decimals: 0, value: 9876543, result: '10 Mil' },
  { id: 'kbytes', decimals: 3, value: 10000000, result: '9.537 GiB' },
  { id: 'deckbytes', decimals: 3, value: 10000000, result: '10.000 GB' },
  { id: 'megwatt', decimals: 3, value: 1000, result: '1.000 GW' },
  { id: 'kohm', decimals: 3, value: 1000, result: '1.000 MΩ' },
  { id: 'Mohm', decimals: 3, value: 1000, result: '1.000 GΩ' },

  { id: 'farad', decimals: 3, value: 1000, result: '1.000 kF' },
  { id: 'µfarad', decimals: 3, value: 1000, result: '1.000 mF' },
  { id: 'nfarad', decimals: 3, value: 1000, result: '1.000 µF' },
  { id: 'pfarad', decimals: 3, value: 1000, result: '1.000 nF' },
  { id: 'ffarad', decimals: 3, value: 1000, result: '1.000 pF' },

  { id: 'henry', decimals: 3, value: 1000, result: '1.000 kH' },
  { id: 'mhenry', decimals: 3, value: 1000, result: '1.000 H' },
  { id: 'µhenry', decimals: 3, value: 1000, result: '1.000 mH' },
];

describe('Chcek KBN value formats', () => {
  for (const test of formatTests) {
    describe(`value format: ${test.id}`, () => {
      it(`should translate ${test.value} as ${test.result}`, () => {
        const result = kbn.valueFormats[test.id](test.value, test.decimals);
        expect(result).toBe(test.result);
      });
    });
  }
});

describe('describe_interval', () => {
  it('falls back to seconds if input is a number', () => {
    expect(kbn.describeInterval('123')).toEqual({
      sec: 1,
      type: 's',
      count: 123,
    });
  });

  it('parses a valid time unt string correctly', () => {
    expect(kbn.describeInterval('123h')).toEqual({
      sec: 3600,
      type: 'h',
      count: 123,
    });
  });

  it('fails if input is invalid', () => {
    expect(() => kbn.describeInterval('123xyz')).toThrow();
    expect(() => kbn.describeInterval('xyz')).toThrow();
  });
});

describe('addSlashes', () => {
  it('properly escapes backslashes, single-quotes, double-quotes and the number zero', () => {
    expect(kbn.addSlashes('this is a \'test\' with "quotes" backslashes (\\) and zero (0)')).toEqual(
      'this is a \\\'test\\\' with \\"quotes\\" backslashes (\\\\) and zero (\\0)'
    );
  });
});
