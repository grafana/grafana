import { getValueProcessor, getColorFromThreshold } from './valueProcessor';
import { getTheme } from '../themes/index';
import { GrafanaThemeType } from '../types/theme';
import { MappingType, ValueMapping } from '../types/panel';

describe('Process values', () => {
  const basicConversions = [
    { value: null, text: '' },
    { value: undefined, text: '' },
    { value: 1.23, text: '1.23' },
    { value: 1, text: '1' },
    { value: 'hello', text: 'hello' },
    { value: {}, text: '[object Object]' },
    { value: [], text: '' },
    { value: [1, 2, 3], text: '1,2,3' },
    { value: ['a', 'b', 'c'], text: 'a,b,c' },
  ];

  it('should return return a string for any input value', () => {
    const processor = getValueProcessor();
    basicConversions.forEach(item => {
      expect(processor(item.value).text).toBe(item.text);
    });
  });

  it('should add a suffix to any value', () => {
    const processor = getValueProcessor({
      prefix: 'xxx',
      theme: getTheme(GrafanaThemeType.Dark),
    });
    basicConversions.forEach(item => {
      expect(processor(item.value).text).toBe('xxx' + item.text);
    });
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
    const instance = getValueProcessor({ mappings: valueMappings });

    const result = instance(value);

    expect(result.text).toEqual('N/A');
  });

  it('should return formatted value if there are no value mappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = '6';

    const instance = getValueProcessor({ mappings: valueMappings, decimals: 1 });

    const result = instance(value);

    expect(result.text).toEqual('6.0');
  });

  it('should return formatted value if there are no matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
      { id: 1, operator: '', text: '1-9', type: MappingType.RangeToText, from: '1', to: '9' },
    ];
    const value = '10';
    const instance = getValueProcessor({ mappings: valueMappings, decimals: 1 });

    const result = instance(value);

    expect(result.text).toEqual('10.0');
  });

  it('should return mapped value if there are matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '11';
    const instance = getValueProcessor({ mappings: valueMappings, decimals: 1 });

    expect(instance(value).text).toEqual('1-20');
  });
});
