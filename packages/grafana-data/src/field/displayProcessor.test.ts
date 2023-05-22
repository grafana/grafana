import { systemDateFormats } from '../datetime';
import { createTheme } from '../themes';
import { FieldConfig, FieldType, ThresholdsMode } from '../types';
import { DisplayProcessor, DisplayValue } from '../types/displayValue';
import { MappingType, ValueMapping } from '../types/valueMapping';
import { ArrayVector } from '../vector';

import { getDisplayProcessor, getRawDisplayProcessor } from './displayProcessor';

function getDisplayProcessorFromConfig(config: FieldConfig, fieldType: FieldType = FieldType.number) {
  return getDisplayProcessor({
    field: {
      config,
      type: fieldType,
    },
    theme: createTheme(),
  });
}

function assertSame(input: unknown, processors: DisplayProcessor[], match: DisplayValue) {
  processors.forEach((processor) => {
    const value = processor(input);
    for (const key of Object.keys(match)) {
      // need to type assert on the object keys here
      // see e.g. https://github.com/Microsoft/TypeScript/issues/12870
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      expect(value[key as keyof typeof match]).toEqual(match[key as keyof typeof match]);
    }
  });
}

describe('Process simple display values', () => {
  // Don't test float values here since the decimal formatting changes
  const processors = [
    // Without options, this shortcuts to a much easier implementation
    getDisplayProcessor({ field: { config: {} }, theme: createTheme() }),

    // Add a simple option that is not used (uses a different base class)
    getDisplayProcessorFromConfig({ min: 0, max: 100 }),

    // Add a simple option that is not used (uses a different base class)
    getDisplayProcessorFromConfig({ unit: 'locale' }),
  ];

  it('support null', () => {
    assertSame(null, processors, { text: '', numeric: NaN });
  });

  it('support undefined', () => {
    assertSame(undefined, processors, { text: '', numeric: NaN });
  });

  it('support NaN', () => {
    assertSame(NaN, processors, { text: 'NaN', numeric: NaN });
  });

  it('Integer', () => {
    assertSame(3, processors, { text: '3', numeric: 3 });
  });

  it('Text to number', () => {
    assertSame('3', processors, { text: '3', numeric: 3 });
  });

  it('Empty string is NaN', () => {
    assertSame('', processors, { text: '', numeric: NaN });
  });

  it('Simple String', () => {
    assertSame('hello', processors, { text: 'hello', numeric: NaN });
  });

  it('empty array', () => {
    assertSame([], processors, { text: '', numeric: NaN });
  });

  it('array of text', () => {
    assertSame(['a', 'b', 'c'], processors, { text: 'a, b, c', numeric: NaN });
  });

  it('array of numbers', () => {
    assertSame([1, 2, 3], processors, { text: '1, 2, 3', numeric: NaN });
  });

  it('empty object', () => {
    assertSame({}, processors, { text: '[object Object]', numeric: NaN });
  });

  it('boolean true', () => {
    assertSame(true, processors, { text: 'true', numeric: 1 });
  });

  it('boolean false', () => {
    assertSame(false, processors, { text: 'false', numeric: 0 });
  });
});

describe('Process null values', () => {
  const processors = [
    getDisplayProcessorFromConfig({
      min: 0,
      max: 100,
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#000' },
          { value: 0, color: '#100' },
          { value: 100, color: '#200' },
        ],
      },
    }),
  ];

  it('Null should get -Infinity (base) color', () => {
    assertSame(null, processors, { text: '', numeric: NaN, color: '#000' });
  });
});

describe('Format value', () => {
  it('should return if value isNaN', () => {
    const valueMappings: ValueMapping[] = [];
    const value = 'N/A';
    const instance = getDisplayProcessorFromConfig({ mappings: valueMappings });

    const result = instance(value);

    expect(result.text).toEqual('N/A');
  });

  it('should return formatted value if there are no value mappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = '6';

    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });

    const result = instance(value);

    expect(result.text).toEqual('6.0');
  });

  it('should return formatted value if there are no matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { '11': { text: 'elva' } } },
      { type: MappingType.RangeToText, options: { from: 1, to: 9, result: { text: '1-9' } } },
    ];

    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = instance('10');

    expect(result.text).toEqual('10.0');
  });

  it('should return icon value if there are matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { '11': { text: 'elva', icon: 'windmill.svg' } } },
    ];

    const display = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = display('11');

    expect(result.icon).toEqual('windmill.svg');
  });

  it('should return icon value if there are matching value mappings in a range', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.RangeToText, options: { from: 1, to: 9, result: { text: '1-9', icon: 'drone.svg' } } },
    ];

    const display = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = display('8');

    expect(result.icon).toEqual('drone.svg');
  });

  it('should return undefined icon value if there are no matching value mappings in a range', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { '11': { text: 'elva', icon: 'windmill.svg' } } },
    ];

    const display = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = display('10');

    expect(result.icon).toEqual(undefined);
  });

  it('should return mapped value if there are matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.ValueToText, options: { '11': { text: 'elva' } } },
      { type: MappingType.RangeToText, options: { from: 1, to: 9, result: { text: '1-9' } } },
    ];

    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = instance('11');

    expect(result.text).toEqual('elva');
  });

  it('should return mapped color but use value format if no value mapping text specified', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.RangeToText, options: { from: 1, to: 9, result: { color: '#FFF' } } },
    ];

    const instance = getDisplayProcessorFromConfig({ decimals: 2, mappings: valueMappings });
    const result = instance(5);

    expect(result.color).toEqual('#FFF');
    expect(result.text).toEqual('5.00');
  });

  it('should replace a matching regex', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.RegexToText, options: { pattern: '([^.]*).example.com', result: { text: '$1' } } },
    ];

    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = instance('hostname.example.com');

    expect(result.text).toEqual('hostname');
  });

  it('should not replace a non-matching regex', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.RegexToText, options: { pattern: '([^.]*).example.com', result: { text: '$1' } } },
    ];

    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = instance('hostname.acme.com');

    expect(result.text).toEqual('hostname.acme.com');
  });

  it('should empty a matching regex without replacement', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.RegexToText, options: { pattern: '([^.]*).example.com', result: { text: '' } } },
    ];

    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = instance('hostname.example.com');

    expect(result.text).toEqual('');
  });

  it('should not empty a non-matching regex', () => {
    const valueMappings: ValueMapping[] = [
      { type: MappingType.RegexToText, options: { pattern: '([^.]*).example.com', result: { text: '' } } },
    ];

    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = instance('hostname.acme.com');

    expect(result.text).toEqual('hostname.acme.com');
  });

  it('should return value with color if mapping has color', () => {
    const valueMappings: ValueMapping[] = [{ type: MappingType.ValueToText, options: { Low: { color: 'red' } } }];

    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });
    const result = instance('Low');

    expect(result.text).toEqual('Low');
    expect(result.color).toEqual('#F2495C');
  });

  it('should return mapped value and leave numeric value in tact if value mapping maps to empty string', () => {
    const valueMappings: ValueMapping[] = [{ type: MappingType.ValueToText, options: { '1': { text: '' } } }];
    const value = '1';
    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });

    expect(instance(value).text).toEqual('');
    expect(instance(value).numeric).toEqual(1);
  });

  it('should not map 1kW to the value for 1W', () => {
    const valueMappings: ValueMapping[] = [{ type: MappingType.ValueToText, options: { '1': { text: 'mapped' } } }];
    const value = '1000';
    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings, unit: 'watt' });

    const result = instance(value);

    expect(result.text).toEqual('1.0');
  });

  it('With null value and thresholds should use base color', () => {
    const instance = getDisplayProcessorFromConfig({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [{ value: -Infinity, color: '#AAA' }],
      },
    });
    const disp = instance(null);
    expect(disp.text).toEqual('');
    expect(disp.color).toEqual('#AAA');
  });

  //
  // Below is current behavior but it's clearly not working great
  //

  it('with value 1000 and unit short', () => {
    const value = 1000;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'short' });
    const disp = instance(value);
    expect(disp.text).toEqual('1');
    expect(disp.suffix).toEqual(' K');
  });

  it('with value 1200 and unit short', () => {
    const value = 1200;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'short' });
    const disp = instance(value);
    expect(disp.text).toEqual('1.20');
    expect(disp.suffix).toEqual(' K');
  });

  it('with value 1250 and unit short', () => {
    const value = 1250;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'short' });
    const disp = instance(value);
    expect(disp.text).toEqual('1.25');
    expect(disp.suffix).toEqual(' K');
  });

  it('with value 10000000 and unit short', () => {
    const value = 1000000;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'short' });
    const disp = instance(value);
    expect(disp.text).toEqual('1');
    expect(disp.suffix).toEqual(' Mil');
  });

  it('with value 15000000 and unit short', () => {
    const value = 1500000;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'short' });
    const disp = instance(value);
    expect(disp.text).toEqual('1.50');
    expect(disp.suffix).toEqual(' Mil');
  });

  it('with value 15000000 and unit locale', () => {
    const value = 1500000;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'locale' });
    const disp = instance(value);
    expect(disp.text).toEqual('1,500,000');
  });

  it('with value 128000000 and unit bytes', () => {
    const value = 1280000125;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'bytes' });
    const disp = instance(value);
    expect(disp.text).toEqual('1.19');
    expect(disp.suffix).toEqual(' GiB');
  });

  describe('number formatting for string values', () => {
    it('should preserve string unchanged if unit is string', () => {
      const processor = getDisplayProcessorFromConfig({ unit: 'string' }, FieldType.string);
      expect(processor('22.1122334455').text).toEqual('22.1122334455');
    });

    it('should preserve string unchanged if no unit is specified', () => {
      const processor = getDisplayProcessorFromConfig({}, FieldType.string);
      expect(processor('22.1122334455').text).toEqual('22.1122334455');

      // Support empty/missing strings
      expect(processor(undefined).text).toEqual('');
      expect(processor(null).text).toEqual('');
      expect(processor('').text).toEqual('');
    });

    it('should format string as number if unit is `none`', () => {
      const processor = getDisplayProcessorFromConfig({ unit: 'none' }, FieldType.string);
      expect(processor('0x10').text).toEqual('16');
    });

    it('should not parse a 64 bit number when the data type is string', () => {
      const value = '2882377905688543293';
      const instance = getDisplayProcessorFromConfig({}, FieldType.string);
      const disp = instance(value);
      expect(disp.text).toEqual(value);
    });
  });

  describe('number formatting for y axis ticks (dynamic decimals with trailing 0s trimming)', () => {
    // all these tests have non-null adjacentDecimals != null, which we only do durink axis tick formatting

    it('should trim trailing zeros after decimal from fractional seconds when formatted as millis with adjacentDecimals=2', () => {
      const processor = getDisplayProcessorFromConfig({ unit: 's' }, FieldType.number);
      expect(processor(0.06, 2).text).toEqual('60');
    });

    it('should trim trailing zeros after decimal from number', () => {
      const processor = getDisplayProcessorFromConfig({}, FieldType.number);
      expect(processor(1.2, 2).text).toEqual('1.2');

      // dynamic!
      expect(processor(13.50008, 3).text).toEqual('13.5');
    });

    it('should not attempt to trim zeros from currency*', () => {
      const processor = getDisplayProcessorFromConfig({ unit: 'currencyUSD' }, FieldType.number);
      expect(processor(1.2, 2).text).toEqual('1.20');
    });

    it('should not attempt to trim zeros from bool', () => {
      const processor = getDisplayProcessorFromConfig({ unit: 'bool' }, FieldType.number);
      expect(processor(1, 2).text).toEqual('True');
    });

    it('should not attempt to trim zeros from time', () => {
      const processor = getDisplayProcessorFromConfig({}, FieldType.time);
      expect(processor(1666402869517, 2).text).toEqual('2022-10-21 20:41:09');
    });

    it('should not attempt to trim zeros from dateTimeAsUS', () => {
      const processor = getDisplayProcessorFromConfig({ unit: 'dateTimeAsUS' }, FieldType.number);
      expect(processor(1666402869517, 2).text).toEqual('10/21/2022 8:41:09 pm');
    });

    it('should not attempt to trim zeros from locale', () => {
      const processor = getDisplayProcessorFromConfig({ unit: 'locale' }, FieldType.number);
      expect(processor(3500000, 2).text).toEqual('3,500,000');
    });

    it('should not attempt to trim zeros when explicit decimals: 5', () => {
      const processor = getDisplayProcessorFromConfig({ decimals: 5 }, FieldType.number);
      expect(processor(35, 2).text).toEqual('35.00000');
    });
  });
});

describe('Date display options', () => {
  it('should format UTC dates', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {
          unit: 'xyz', // ignore non-date formats
        },
      },
      theme: createTheme(),
    });
    expect(processor(0).text).toEqual('1970-01-01 00:00:00');
  });

  it('should pick configured time format', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {
          unit: 'dateTimeAsUS', // ignore non-date formats
        },
      },
      theme: createTheme(),
    });
    expect(processor(0).text).toEqual('01/01/1970 12:00:00 am');
  });

  it('respect the configured date format', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {
          unit: 'time:YYYY', // ignore non-date formats
        },
      },
      theme: createTheme(),
    });
    expect(processor(0).text).toEqual('1970');
  });

  it('Should use system date format by default', () => {
    const currentFormat = systemDateFormats.fullDate;
    systemDateFormats.fullDate = 'YYYY-MM';

    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {},
      },
      theme: createTheme(),
    });

    expect(processor(0).text).toEqual('1970-01');

    systemDateFormats.fullDate = currentFormat;
  });

  it('should handle ISO string dates', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {},
      },
      theme: createTheme(),
    });

    expect(processor('2020-08-01T08:48:43.783337Z').text).toEqual('2020-08-01 08:48:43');
  });

  it('should handle ISO string dates when in other timezones than UTC', () => {
    const processor = getDisplayProcessor({
      timeZone: 'CET',
      field: {
        type: FieldType.time,
        config: {},
      },
      theme: createTheme(),
    });

    expect(processor('2020-08-01T08:48:43.783337Z').text).toEqual('2020-08-01 10:48:43'); //DST
    expect(processor('2020-12-01T08:48:43.783337Z').text).toEqual('2020-12-01 09:48:43'); //STD
  });

  it('should handle ISO string dates with timezone offset', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {},
      },
      theme: createTheme(),
    });

    expect(processor('2020-12-01T08:48:43.783337+02:00').text).toEqual('2020-12-01 06:48:43');
  });

  it('should handle ISO string dates without timezone qualifier by assuming UTC', () => {
    const processor = getDisplayProcessor({
      timeZone: 'CET',
      field: {
        type: FieldType.time,
        config: {},
      },
      theme: createTheme(),
    });

    expect(processor('2020-12-01T08:48:43.783337').text).toEqual('2020-12-01 09:48:43');
  });

  it('should include milliseconds when value range is < 60s', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {},
        values: new ArrayVector([Date.parse('2020-08-01T08:48:43.783337Z'), Date.parse('2020-08-01T08:49:15.123456Z')]),
      },
      theme: createTheme(),
    });

    expect(processor('2020-08-01T08:48:43.783337Z').text).toEqual('2020-08-01 08:48:43.783');
  });

  it('should not include milliseconds when value range is >= 60s (reversed)', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {},
        values: new ArrayVector([Date.parse('2020-08-01T08:49:15.123456Z'), Date.parse('2020-08-01T08:43:43.783337Z')]),
      },
      theme: createTheme(),
    });

    expect(processor('2020-08-01T08:48:43Z').text).toEqual('2020-08-01 08:48:43');
  });

  it('should not include milliseconds when value range is < 60s with explicit unit time:', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
        config: {
          unit: 'time:YYYY-MM-DD HH:mm',
        },
        values: new ArrayVector([Date.parse('2020-08-01T08:48:43.783337Z'), Date.parse('2020-08-01T08:49:15.123456Z')]),
      },
      theme: createTheme(),
    });

    expect(processor('2020-08-01T08:48:43.783337Z').text).toEqual('2020-08-01 08:48');
  });
});

describe('getRawDisplayProcessor', () => {
  const processor = getRawDisplayProcessor();
  const date = new Date('2020-01-01T00:00:00.000Z');
  const timestamp = date.valueOf();

  it.each`
    value                             | expected
    ${0}                              | ${'0'}
    ${13.37}                          | ${'13.37'}
    ${true}                           | ${'true'}
    ${false}                          | ${'false'}
    ${date}                           | ${`${date}`}
    ${timestamp}                      | ${'1577836800000'}
    ${'a string'}                     | ${'a string'}
    ${null}                           | ${'null'}
    ${undefined}                      | ${'undefined'}
    ${{ value: 0, label: 'a label' }} | ${'{"value":0,"label":"a label"}'}
  `('when called with value:{$value}', ({ value, expected }) => {
    const result = processor(value);

    expect(result).toEqual({ text: expected, numeric: null });
  });
});
