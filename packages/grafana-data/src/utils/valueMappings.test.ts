import { getValueMappingResult, isNumeric } from './valueMappings';
import { ValueMapping, MappingType, NullToTextMatchType } from '../types';

const testSet1: ValueMapping[] = [
  {
    type: MappingType.ValueToText,
    options: { '11': { text: 'elva' } },
  },
  {
    type: MappingType.RangeToText,
    options: {
      from: 1,
      to: 9,
      result: { text: '1-9' },
    },
  },
  {
    type: MappingType.RangeToText,
    options: {
      from: 8,
      to: 12,
      result: { text: '8-12' },
    },
  },
  {
    type: MappingType.NullToText,
    options: {
      match: NullToTextMatchType.Null,
      result: { text: 'it is null' },
    },
  },
  {
    type: MappingType.NullToText,
    options: {
      match: NullToTextMatchType.NaN,
      result: { text: 'it is nan' },
    },
  },
];

describe('Format value with value mappings', () => {
  it('should return null with no valuemappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = '10';

    expect(getValueMappingResult(valueMappings, value)).toBeNull();
  });

  it('should return null with no matching valuemappings', () => {
    const value = '100';
    expect(getValueMappingResult(testSet1, value)).toBeNull();
  });

  it('should return match result with string value match', () => {
    const value = '11';
    expect(getValueMappingResult(testSet1, value)).toEqual({ text: 'elva' });
  });

  it('should return match result with number value', () => {
    const value = 11;
    expect(getValueMappingResult(testSet1, value)).toEqual({ text: 'elva' });
  });

  it('should return match result for null value', () => {
    const value = null;
    expect(getValueMappingResult(testSet1, value)).toEqual({ text: 'it is null' });
  });

  it('should return match result for undefined value', () => {
    const value = undefined;
    expect(getValueMappingResult(testSet1, value as any)).toEqual({ text: 'it is null' });
  });

  it('should return match result for nan value', () => {
    const value = Number.NaN;
    expect(getValueMappingResult(testSet1, value as any)).toEqual({ text: 'it is nan' });
  });

  it('should return range mapping that matches first', () => {
    const value = '9';
    expect(getValueMappingResult(testSet1, value)).toEqual({ text: '1-9' });
  });

  it('should return correct range mapping result', () => {
    const value = '12';
    expect(getValueMappingResult(testSet1, value)).toEqual({ text: '8-12' });
  });

  //   it.each`
  //     value            | expected
  //     ${'2/0/12'}      | ${{ id: 1, text: 'mapped value 1', type: MappingType.ValueToText, value: '2/0/12' }}
  //     ${'2/1/12'}      | ${undefined}
  //     ${'2:0'}         | ${{ id: 3, text: 'mapped value 3', type: MappingType.ValueToText, value: '2:0' }}
  //     ${'2:1'}         | ${undefined}
  //     ${'20whatever'}  | ${{ id: 2, text: 'mapped value 2', type: MappingType.ValueToText, value: '20whatever' }}
  //     ${'20whateve'}   | ${undefined}
  //     ${'20'}          | ${undefined}
  //     ${'00020.4'}     | ${undefined}
  //     ${'192.168.1.1'} | ${{ id: 4, text: 'mapped value ip', type: MappingType.ValueToText, value: '192.168.1.1' }}
  //     ${'192'}         | ${undefined}
  //     ${'192.168'}     | ${undefined}
  //     ${'192.168.1'}   | ${undefined}
  //     ${'9.90'}        | ${{ id: 5, text: 'OK', type: MappingType.ValueToText, value: '9.9' }}
  //   `('numeric-like text mapping, value:${value', ({ value, expected }) => {
  //     const valueMappings: ValueMapping[] = [
  //       { id: 1, text: 'mapped value 1', type: MappingType.ValueToText, value: '2/0/12' },
  //       { id: 2, text: 'mapped value 2', type: MappingType.ValueToText, value: '20whatever' },
  //       { id: 3, text: 'mapped value 3', type: MappingType.ValueToText, value: '2:0' },
  //       { id: 4, text: 'mapped value ip', type: MappingType.ValueToText, value: '192.168.1.1' },
  //       { id: 5, text: 'OK', type: MappingType.ValueToText, value: '9.9' },
  //     ];
  //     expect(getMappedValue(valueMappings, value)).toEqual(expected);
  //   });
  // });
});

describe('isNumeric', () => {
  it.each`
    value         | expected
    ${123}        | ${true}
    ${0}          | ${true}
    ${'123'}      | ${true}
    ${'0'}        | ${true}
    ${' 123'}     | ${true}
    ${' 123 '}    | ${true}
    ${' 0 '}      | ${true}
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
