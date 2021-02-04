import { getMappedValue, isNumeric } from './valueMappings';
import { ValueMapping, MappingType } from '../types';

describe('Format value with value mappings', () => {
  it('should return undefined with no valuemappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = '10';

    expect(getMappedValue(valueMappings, value)).toBeUndefined();
  });

  it('should return undefined with no matching valuemappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, text: 'elva', type: MappingType.ValueToText, value: '11' },
      { id: 1, text: '1-9', type: MappingType.RangeToText, from: '1', to: '9' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value)).toBeUndefined();
  });

  it('should return first matching mapping with lowest id', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, text: 'tio', type: MappingType.ValueToText, value: '10' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value).text).toEqual('1-20');
  });

  it('should return if value is null and value to text mapping value is null', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, text: '<NULL>', type: MappingType.ValueToText, value: 'null' },
    ];
    const value = null;

    expect(getMappedValue(valueMappings, value).text).toEqual('<NULL>');
  });

  it('should return if value is null and range to text mapping from and to is null', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, text: '<NULL>', type: MappingType.RangeToText, from: 'null', to: 'null' },
      { id: 1, text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = null;

    expect(getMappedValue(valueMappings, value).text).toEqual('<NULL>');
  });

  it('should return rangeToText mapping where value equals to', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, text: '1-10', type: MappingType.RangeToText, from: '1', to: '10' },
      { id: 1, text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value).text).toEqual('1-10');
  });

  it('should return rangeToText mapping where value equals from', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, text: '10-20', type: MappingType.RangeToText, from: '10', to: '20' },
      { id: 1, text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value).text).toEqual('10-20');
  });

  it('should return rangeToText mapping where value is between from and to', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '10';

    expect(getMappedValue(valueMappings, value).text).toEqual('1-20');
  });

  describe('text mapping', () => {
    it('should map value text to mapping', () => {
      const valueMappings: ValueMapping[] = [
        { id: 0, text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
        { id: 1, text: 'ELVA', type: MappingType.ValueToText, value: 'elva' },
      ];

      const value = 'elva';

      expect(getMappedValue(valueMappings, value).text).toEqual('ELVA');
    });

    it.each`
      value            | expected
      ${'2/0/12'}      | ${{ id: 1, text: 'mapped value 1', type: MappingType.ValueToText, value: '2/0/12' }}
      ${'2/1/12'}      | ${undefined}
      ${'2:0'}         | ${{ id: 3, text: 'mapped value 3', type: MappingType.ValueToText, value: '2:0' }}
      ${'2:1'}         | ${undefined}
      ${'20whatever'}  | ${{ id: 2, text: 'mapped value 2', type: MappingType.ValueToText, value: '20whatever' }}
      ${'20whateve'}   | ${undefined}
      ${'20'}          | ${undefined}
      ${'00020.4'}     | ${undefined}
      ${'192.168.1.1'} | ${{ id: 4, text: 'mapped value ip', type: MappingType.ValueToText, value: '192.168.1.1' }}
      ${'192'}         | ${undefined}
      ${'192.168'}     | ${undefined}
      ${'192.168.1'}   | ${undefined}
      ${'9.90'}        | ${{ id: 5, text: 'OK', type: MappingType.ValueToText, value: '9.9' }}
    `('numeric-like text mapping, value:${value', ({ value, expected }) => {
      const valueMappings: ValueMapping[] = [
        { id: 1, text: 'mapped value 1', type: MappingType.ValueToText, value: '2/0/12' },
        { id: 2, text: 'mapped value 2', type: MappingType.ValueToText, value: '20whatever' },
        { id: 3, text: 'mapped value 3', type: MappingType.ValueToText, value: '2:0' },
        { id: 4, text: 'mapped value ip', type: MappingType.ValueToText, value: '192.168.1.1' },
        { id: 5, text: 'OK', type: MappingType.ValueToText, value: '9.9' },
      ];
      expect(getMappedValue(valueMappings, value)).toEqual(expected);
    });
  });
});

describe('isNumeric', () => {
  it.each`
    value         | expected
    ${123}        | ${true}
    ${'123'}      | ${true}
    ${' 123'}     | ${true}
    ${' 123 '}    | ${true}
    ${-123.4}     | ${true}
    ${'-123.4'}   | ${true}
    ${0.41}       | ${true}
    ${'.41'}      | ${true}
    ${0x12}       | ${true}
    ${'0x12'}     | ${true}
    ${'000123.4'} | ${true}
    ${2e64}       | ${true}
    ${'2e64'}     | ${true}
    ${1e10000}    | ${true}
    ${'1e10000'}  | ${true}
    ${Infinity}   | ${true}
    ${'abc'}      | ${false}
    ${' '}        | ${false}
    ${null}       | ${false}
    ${undefined}  | ${false}
    ${NaN}        | ${false}
    ${''}         | ${false}
    ${{}}         | ${false}
    ${true}       | ${false}
    ${[]}         | ${false}
  `('detects numeric values', ({ value, expected }) => {
    expect(isNumeric(value)).toEqual(expected);
  });
});
