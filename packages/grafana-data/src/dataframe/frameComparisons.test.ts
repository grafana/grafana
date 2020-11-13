import { FieldType } from '../types/dataFrame';
import { framesHaveSameStructure, compareArrayValues } from './frameComparisons';
import { toDataFrame } from './processDataFrame';

describe('test comparisons', () => {
  const frameA = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
      { name: 'value', type: FieldType.number, values: [1, 2, 3] },
    ],
  });
  const frameB = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [100, 200, 300] },
      {
        name: 'value',
        type: FieldType.number,
        values: [1, 2, 3],
        config: {
          decimals: 4,
        },
      },
    ],
  });
  const field0 = frameB.fields[0];
  const field1 = frameB.fields[1];

  it('should support null/undefined without crash', () => {
    expect(framesHaveSameStructure(frameA, frameA)).toBeTruthy();
    expect(framesHaveSameStructure(frameA, { ...frameA })).toBeTruthy();
    expect(framesHaveSameStructure(frameA, frameB)).toBeFalsy();
    expect(framesHaveSameStructure(frameA, null as any)).toBeFalsy();
    expect(framesHaveSameStructure(undefined as any, frameA)).toBeFalsy();

    expect(compareArrayValues([frameA], [frameA], framesHaveSameStructure)).toBeTruthy();
    expect(compareArrayValues([frameA], null as any, framesHaveSameStructure)).toBeFalsy();
    expect(compareArrayValues(null as any, [frameA], framesHaveSameStructure)).toBeFalsy();
  });

  it('name change and field copy is not a structure change', () => {
    expect(framesHaveSameStructure(frameB, { ...frameB, name: 'AA' })).toBeTruthy();
    expect(framesHaveSameStructure(frameB, { ...frameB, fields: [field0, field1] })).toBeTruthy();
  });

  it('changing type should change the config', () => {
    expect(
      framesHaveSameStructure(frameB, {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            type: FieldType.trace, // Change the type
          },
        ],
      })
    ).toBeFalsy();
  });

  it('full copy of config will not change structure', () => {
    expect(
      framesHaveSameStructure(frameB, {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            config: {
              ...field1.config, // no change
            },
          },
        ],
      })
    ).toBeTruthy(); // no change
  });

  it('adding an additional config field', () => {
    expect(
      framesHaveSameStructure(frameB, {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            config: {
              ...field1.config,
              unit: 'rpm',
            },
          },
        ],
      })
    ).toBeFalsy();
  });
});
