import { getDisplayProcessor, getColorFromThreshold, DisplayProcessor, getDecimalsForValue } from './displayValue';
import { DisplayValue, MappingType, ValueMapping } from '../types';

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
    getDisplayProcessor({ color: '#FFF' }),

    // Add a simple option that is not used (uses a different base class)
    getDisplayProcessor({ unit: 'locale' }),
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

describe('Processor with more configs', () => {
  it('support prefix & suffix', () => {
    const processor = getDisplayProcessor({
      prefix: 'AA_',
      suffix: '_ZZ',
    });

    expect(processor('XXX').text).toEqual('AA_XXX_ZZ');
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
    const instance = getDisplayProcessor({ mappings: valueMappings });

    const result = instance(value);

    expect(result.text).toEqual('N/A');
  });

  it('should return formatted value if there are no value mappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = '6';

    const instance = getDisplayProcessor({ mappings: valueMappings, decimals: 1 });

    const result = instance(value);

    expect(result.text).toEqual('6.0');
  });

  it('should return formatted value if there are no matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
      { id: 1, operator: '', text: '1-9', type: MappingType.RangeToText, from: '1', to: '9' },
    ];
    const value = '10';
    const instance = getDisplayProcessor({ mappings: valueMappings, decimals: 1 });

    const result = instance(value);

    expect(result.text).toEqual('10.0');
  });

  it('should set auto decimals, 1 significant', () => {
    const value = '1.23';
    const instance = getDisplayProcessor({ decimals: null });

    expect(instance(value).text).toEqual('1.2');
  });

  it('should set auto decimals, 2 significant', () => {
    const value = '0.0245';
    const instance = getDisplayProcessor({ decimals: null });

    expect(instance(value).text).toEqual('0.02');
  });

  it('should return mapped value if there are matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '11';
    const instance = getDisplayProcessor({ mappings: valueMappings, decimals: 1 });

    expect(instance(value).text).toEqual('1-20');
  });
});

describe('getDecimalsForValue()', () => {
  it('should calculate reasonable decimals precision for given value', () => {
    expect(getDecimalsForValue(1.01)).toEqual({ decimals: 1, scaledDecimals: 4 });
    expect(getDecimalsForValue(9.01)).toEqual({ decimals: 0, scaledDecimals: 2 });
    expect(getDecimalsForValue(1.1)).toEqual({ decimals: 1, scaledDecimals: 4 });
    expect(getDecimalsForValue(2)).toEqual({ decimals: 0, scaledDecimals: 2 });
    expect(getDecimalsForValue(20)).toEqual({ decimals: 0, scaledDecimals: 1 });
    expect(getDecimalsForValue(200)).toEqual({ decimals: 0, scaledDecimals: 0 });
    expect(getDecimalsForValue(2000)).toEqual({ decimals: 0, scaledDecimals: 0 });
    expect(getDecimalsForValue(20000)).toEqual({ decimals: 0, scaledDecimals: -2 });
    expect(getDecimalsForValue(200000)).toEqual({ decimals: 0, scaledDecimals: -3 });
    expect(getDecimalsForValue(200000000)).toEqual({ decimals: 0, scaledDecimals: -6 });
  });
});
