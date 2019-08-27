import { MappingType, ValueMapping, DisplayProcessor, DisplayValue } from '@grafana/data';
import { getDisplayProcessor, getColorFromThreshold } from './displayProcessor';

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
    getDisplayProcessor({ field: { min: 0, max: 100 } }),

    // Add a simple option that is not used (uses a different base class)
    getDisplayProcessor({ field: { unit: 'locale' } }),
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
    const instance = getDisplayProcessor({ field: { mappings: valueMappings } });

    const result = instance(value);

    expect(result.text).toEqual('N/A');
  });

  it('should return formatted value if there are no value mappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = '6';

    const instance = getDisplayProcessor({ field: { decimals: 1, mappings: valueMappings } });

    const result = instance(value);

    expect(result.text).toEqual('6.0');
  });

  it('should return formatted value if there are no matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
      { id: 1, operator: '', text: '1-9', type: MappingType.RangeToText, from: '1', to: '9' },
    ];
    const value = '10';
    const instance = getDisplayProcessor({ field: { decimals: 1, mappings: valueMappings } });

    const result = instance(value);

    expect(result.text).toEqual('10.0');
  });

  it('should set auto decimals, 1 significant', () => {
    const value = 3.23;
    const instance = getDisplayProcessor({ field: { decimals: null } });
    expect(instance(value).text).toEqual('3.2');
  });

  it('should set auto decimals, 2 significant', () => {
    const value = 0.0245;
    const instance = getDisplayProcessor({ field: { decimals: null } });

    expect(instance(value).text).toEqual('0.025');
  });

  it('should use override decimals', () => {
    const value = 100030303;
    const instance = getDisplayProcessor({ field: { decimals: 2, unit: 'bytes' } });
    expect(instance(value).text).toEqual('95.40 MiB');
  });

  it('should return mapped value if there are matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '11';
    const instance = getDisplayProcessor({ field: { decimals: 1, mappings: valueMappings } });

    expect(instance(value).text).toEqual('1-20');
  });

  //
  // Below is current behavior but I it's clearly not working great
  //

  it('with value 1000 and unit short', () => {
    const value = 1000;
    const instance = getDisplayProcessor({ field: { decimals: null, unit: 'short' } });
    expect(instance(value).text).toEqual('1.000 K');
  });

  it('with value 1200 and unit short', () => {
    const value = 1200;
    const instance = getDisplayProcessor({ field: { decimals: null, unit: 'short' } });
    expect(instance(value).text).toEqual('1.200 K');
  });

  it('with value 1250 and unit short', () => {
    const value = 1250;
    const instance = getDisplayProcessor({ field: { decimals: null, unit: 'short' } });
    expect(instance(value).text).toEqual('1.250 K');
  });

  it('with value 10000000 and unit short', () => {
    const value = 1000000;
    const instance = getDisplayProcessor({ field: { decimals: null, unit: 'short' } });
    expect(instance(value).text).toEqual('1.000 Mil');
  });
});
