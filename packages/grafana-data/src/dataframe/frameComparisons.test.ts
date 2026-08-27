import { type DataFrame, FieldType } from '../types/dataFrame';

import { compareDataFrameStructures, compareArrayValues } from './frameComparisons';
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
        labels: { server: 'A' },
      },
    ],
  });
  const field0 = frameB.fields[0];
  const field1 = frameB.fields[1];

  it('a frame is structurally equal to itself and to a shallow copy', () => {
    expect(compareDataFrameStructures(frameA, frameA)).toBe(true);
    expect(compareDataFrameStructures(frameA, { ...frameA })).toBe(true);
  });

  it('a differing field count should be a structure change', () => {
    // frameA has time/name/value, frameB only time/value
    expect(compareDataFrameStructures(frameA, frameB)).toBe(false);
  });

  it('a nullish frame on either side should be a structure change', () => {
    expect(compareDataFrameStructures(frameA, null as unknown as DataFrame)).toBe(false);
    expect(compareDataFrameStructures(undefined as unknown as DataFrame, frameA)).toBe(false);
  });

  it('name change should be a structure change', () => {
    expect(compareDataFrameStructures(frameB, { ...frameB, name: 'AA' })).toBe(false);
  });

  it('label change should be a structure change', () => {
    const changedFrameB = {
      ...frameB,
      fields: [
        frameB.fields[0],
        {
          ...frameB.fields[1],
          labels: { server: 'B' },
        },
      ],
    };
    expect(compareDataFrameStructures(frameB, changedFrameB)).toBe(false);
  });

  it('Field copy should not be a structure change', () => {
    expect(compareDataFrameStructures(frameB, { ...frameB, fields: [field0, field1] })).toBe(true);
  });

  it('changing a field type should be a structure change', () => {
    expect(
      compareDataFrameStructures(frameB, {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            type: FieldType.trace, // Change the type
          },
        ],
      })
    ).toBe(false);
  });

  it('full copy of config will not change structure', () => {
    expect(
      compareDataFrameStructures(frameB, {
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
    ).toBe(true);
  });

  it('adding an additional config field should be a structure change', () => {
    expect(
      compareDataFrameStructures(frameB, {
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
    ).toBe(false);
  });

  describe('custom config comparison', () => {
    const withCustomConfig = (custom: Record<string, unknown>): DataFrame => ({
      ...frameB,
      fields: [field0, { ...field1, config: { custom } }],
    });

    it.each([
      { desc: 'equal flat custom configs', a: { a: 1, b: 'test' }, b: { a: 1, b: 'test' }, expected: true },
      { desc: 'flat custom configs with a differing value', a: { a: 1 }, b: { a: 2 }, expected: false },
      { desc: 'equal nested custom configs', a: { a: { b: 1 } }, b: { a: { b: 1 } }, expected: true },
      { desc: 'nested custom configs with a differing leaf', a: { a: { b: 1 } }, b: { a: { b: 2 } }, expected: false },
    ])('returns $expected for $desc', ({ a, b, expected }) => {
      expect(compareDataFrameStructures(withCustomConfig(a), withCustomConfig(b))).toBe(expected);
    });
  });

  describe('compareArrayValues', () => {
    it('returns true when every pair satisfies the comparator', () => {
      expect(compareArrayValues([frameA], [frameA], compareDataFrameStructures)).toBe(true);
    });

    it('returns false when a pair fails the comparator', () => {
      expect(compareArrayValues([frameA], [frameB], compareDataFrameStructures)).toBe(false);
    });

    it('returns false when either array is nullish', () => {
      expect(compareArrayValues([frameA], null as unknown as DataFrame[], compareDataFrameStructures)).toBe(false);
      expect(compareArrayValues(null as unknown as DataFrame[], [frameA], compareDataFrameStructures)).toBe(false);
    });
  });
});
