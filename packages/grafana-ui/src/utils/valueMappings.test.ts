import { getMappedValue } from './valueMappings';
import { ValueMapping, MappingType } from '../types/panel';

describe('Format value with value mappings', () => {
  it('should return undefined with no valuemappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = '10';

    expect(getMappedValue(valueMappings, value)).toBeUndefined();
  });

  it('should return undefined with no matching valuemappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
      { id: 1, operator: '', text: '1-9', type: MappingType.RangeToText, from: '1', to: '9' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value)).toBeUndefined();
  });

  it('should return first matching mapping with lowest id', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: 'tio', type: MappingType.ValueToText, value: '10' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value).text).toEqual('1-20');
  });

  it('should return if value is null and value to text mapping value is null', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: '<NULL>', type: MappingType.ValueToText, value: 'null' },
    ];
    const value = null;

    expect(getMappedValue(valueMappings, value).text).toEqual('<NULL>');
  });

  it('should return if value is null and range to text mapping from and to is null', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '<NULL>', type: MappingType.RangeToText, from: 'null', to: 'null' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = null;

    expect(getMappedValue(valueMappings, value).text).toEqual('<NULL>');
  });

  it('should return rangeToText mapping where value equals to', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-10', type: MappingType.RangeToText, from: '1', to: '10' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value).text).toEqual('1-10');
  });

  it('should return rangeToText mapping where value equals from', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '10-20', type: MappingType.RangeToText, from: '10', to: '20' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value).text).toEqual('10-20');
  });

  it('should return rangeToText mapping where value is between from and to', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value).text).toEqual('1-20');
  });
});
