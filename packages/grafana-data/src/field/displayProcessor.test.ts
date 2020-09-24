import { getDisplayProcessor, getRawDisplayProcessor } from './displayProcessor';
import { DisplayProcessor, DisplayValue } from '../types/displayValue';
import { MappingType, ValueMapping } from '../types/valueMapping';
import { Field, FieldConfig, FieldType, GrafanaTheme, Threshold, ThresholdsMode } from '../types';
import { getScaleCalculator, sortThresholds } from './scale';
import { ArrayVector } from '../vector';
import { validateFieldConfig } from './fieldOverrides';
import { systemDateFormats } from '../datetime';

function getDisplayProcessorFromConfig(config: FieldConfig) {
  return getDisplayProcessor({
    field: {
      config,
      type: FieldType.number,
    },
  });
}

function getColorFromThreshold(value: number, steps: Threshold[], theme?: GrafanaTheme): string {
  const field: Field = {
    name: 'test',
    config: { thresholds: { mode: ThresholdsMode.Absolute, steps: sortThresholds(steps) } },
    type: FieldType.number,
    values: new ArrayVector([]),
  };
  validateFieldConfig(field.config!);
  const calc = getScaleCalculator(field, theme);
  return calc(value).color!;
}

function assertSame(input: any, processors: DisplayProcessor[], match: DisplayValue) {
  processors.forEach(processor => {
    const value = processor(input);
    expect(value.text).toEqual(match.text);
    if (match.hasOwnProperty('numeric')) {
      expect(value.numeric).toEqual(match.numeric);
    }
  });
}

describe('Process simple display values', () => {
  // Don't test float values here since the decimal formatting changes
  const processors = [
    // Without options, this shortcuts to a much easier implementation
    getDisplayProcessor(),

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
    assertSame(['a', 'b', 'c'], processors, { text: 'a,b,c', numeric: NaN });
  });

  it('array of numbers', () => {
    assertSame([1, 2, 3], processors, { text: '1,2,3', numeric: NaN });
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

describe('Get color from threshold', () => {
  it('should get first threshold color when only one threshold', () => {
    const thresholds = [{ index: 0, value: -Infinity, color: '#7EB26D' }];
    expect(getColorFromThreshold(49, thresholds)).toEqual('#7EB26D');
  });

  it('should get the threshold color if value is same as a threshold', () => {
    const thresholds = [
      { index: 2, value: 75, color: '#6ED0E0' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#7EB26D' },
    ];
    expect(getColorFromThreshold(50, thresholds)).toEqual('#EAB839');
  });

  it('should get the nearest threshold color between thresholds', () => {
    const thresholds = [
      { index: 2, value: 75, color: '#6ED0E0' },
      { index: 1, value: 50, color: '#EAB839' },
      { index: 0, value: -Infinity, color: '#7EB26D' },
    ];
    expect(getColorFromThreshold(55, thresholds)).toEqual('#EAB839');
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
      { id: 0, text: 'elva', type: MappingType.ValueToText, value: '11' },
      { id: 1, text: '1-9', type: MappingType.RangeToText, from: '1', to: '9' },
    ];
    const value = '10';
    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });

    const result = instance(value);

    expect(result.text).toEqual('10.0');
  });

  it('should set auto decimals, 1 significant', () => {
    const value = 3.23;
    const instance = getDisplayProcessorFromConfig({ decimals: null });
    expect(instance(value).text).toEqual('3.2');
  });

  it('should set auto decimals, 2 significant', () => {
    const value = 0.0245;
    const instance = getDisplayProcessorFromConfig({ decimals: null });

    expect(instance(value).text).toEqual('0.025');
  });

  it('should use override decimals', () => {
    const value = 100030303;
    const instance = getDisplayProcessorFromConfig({ decimals: 2, unit: 'bytes' });
    const disp = instance(value);
    expect(disp.text).toEqual('95.40');
    expect(disp.suffix).toEqual(' MiB');
  });

  it('should return mapped value if there are matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '11';
    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });

    expect(instance(value).text).toEqual('1-20');
  });

  it('should return mapped value and leave numeric value in tact if value mapping maps to empty string', () => {
    const valueMappings: ValueMapping[] = [{ id: 1, text: '', type: MappingType.ValueToText, value: '1' }];
    const value = '1';
    const instance = getDisplayProcessorFromConfig({ decimals: 1, mappings: valueMappings });

    expect(instance(value).text).toEqual('');
    expect(instance(value).numeric).toEqual(1);
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
    expect(disp.text).toEqual('1.000');
    expect(disp.suffix).toEqual(' K');
  });

  it('with value 1200 and unit short', () => {
    const value = 1200;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'short' });
    const disp = instance(value);
    expect(disp.text).toEqual('1.200');
    expect(disp.suffix).toEqual(' K');
  });

  it('with value 1250 and unit short', () => {
    const value = 1250;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'short' });
    const disp = instance(value);
    expect(disp.text).toEqual('1.250');
    expect(disp.suffix).toEqual(' K');
  });

  it('with value 10000000 and unit short', () => {
    const value = 1000000;
    const instance = getDisplayProcessorFromConfig({ decimals: null, unit: 'short' });
    const disp = instance(value);
    expect(disp.text).toEqual('1.000');
    expect(disp.suffix).toEqual(' Mil');
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
    });

    expect(processor(0).text).toEqual('1970-01');

    systemDateFormats.fullDate = currentFormat;
  });

  it('should handle ISO string dates', () => {
    const processor = getDisplayProcessor({
      timeZone: 'utc',
      field: {
        type: FieldType.time,
      },
    });

    expect(processor('2020-08-01T08:48:43.783337Z').text).toEqual('2020-08-01 08:48:43');
  });

  describe('number formatting for string values', () => {
    it('should preserve string unchanged if unit is strings', () => {
      const processor = getDisplayProcessor({
        field: {
          type: FieldType.string,
          config: { unit: 'string' },
        },
      });
      expect(processor('22.1122334455').text).toEqual('22.1122334455');
    });

    it('should format string as number if no unit', () => {
      const processor = getDisplayProcessor({
        field: {
          type: FieldType.string,
          config: { decimals: 2 },
        },
      });
      expect(processor('22.1122334455').text).toEqual('22.11');
    });
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
    ${{ value: 0, label: 'a label' }} | ${'[object Object]'}
  `('when called with value:{$value}', ({ value, expected }) => {
    const result = processor(value);

    expect(result).toEqual({ text: expected, numeric: null });
  });
});
