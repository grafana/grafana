import { DataFrame, FieldType } from '../types/dataFrame';

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

  it('should support null/undefined without crash', () => {
    expect(compareDataFrameStructures(frameA, frameA)).toBeTruthy();
    expect(compareDataFrameStructures(frameA, { ...frameA })).toBeTruthy();
    expect(compareDataFrameStructures(frameA, frameB)).toBeFalsy();
    expect(compareDataFrameStructures(frameA, null as unknown as DataFrame)).toBeFalsy();
    expect(compareDataFrameStructures(undefined as unknown as DataFrame, frameA)).toBeFalsy();

    expect(compareArrayValues([frameA], [frameA], compareDataFrameStructures)).toBeTruthy();
    expect(compareArrayValues([frameA], null as unknown as DataFrame[], compareDataFrameStructures)).toBeFalsy();
    expect(compareArrayValues(null as unknown as DataFrame[], [frameA], compareDataFrameStructures)).toBeFalsy();
  });

  it('name change should be a structure change', () => {
    expect(compareDataFrameStructures(frameB, { ...frameB, name: 'AA' })).toBeFalsy();
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
    expect(compareDataFrameStructures(frameB, changedFrameB)).toBeFalsy();
  });

  it('Field copy should not be a structure change', () => {
    expect(compareDataFrameStructures(frameB, { ...frameB, fields: [field0, field1] })).toBeTruthy();
  });

  it('changing type should change the config', () => {
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
    ).toBeFalsy();
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
    ).toBeTruthy(); // no change
  });

  it('adding an additional config field', () => {
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
    ).toBeFalsy();
  });

  describe('custom config comparison', () => {
    it('handles custom config shallow equality', () => {
      const a = {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            config: {
              custom: {
                a: 1,
                b: 'test',
              },
            },
          },
        ],
      };

      const b = {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            config: {
              custom: {
                a: 1,
                b: 'test',
              },
            },
          },
        ],
      };

      expect(compareDataFrameStructures(a, b)).toBeTruthy();
    });

    it('handles custom config shallow inequality', () => {
      const a = {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            config: {
              custom: {
                a: 1,
              },
            },
          },
        ],
      };

      const b = {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            config: {
              custom: {
                a: 2,
              },
            },
          },
        ],
      };

      expect(compareDataFrameStructures(a, b)).toBeFalsy();
    });

    it('does deep comparison', () => {
      const a = {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            config: {
              custom: {
                a: {
                  b: 1,
                },
              },
            },
          },
        ],
      };

      const b = {
        ...frameB,
        fields: [
          field0,
          {
            ...field1,
            config: {
              custom: {
                a: {
                  b: 1,
                },
              },
            },
          },
        ],
      };

      expect(compareDataFrameStructures(a, b)).toBeTruthy();
    });
  });
});
