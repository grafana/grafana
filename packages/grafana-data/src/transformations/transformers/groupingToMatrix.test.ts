import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType, Field } from '../../types/dataFrame';
import { DataTransformerConfig, SpecialValue } from '../../types/transformations';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { GroupingToMatrixTransformerOptions, groupingToMatrixTransformer } from './groupingToMatrix';
import { DataTransformerID } from './ids';

describe('Grouping to Matrix', () => {
  beforeAll(() => {
    mockTransformationsRegistry([groupingToMatrixTransformer]);
  });

  it('generates Matrix with default fields', async () => {
    const cfg: DataTransformerConfig<GroupingToMatrixTransformerOptions> = {
      id: DataTransformerID.groupingToMatrix,
      options: {},
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1001, 1002] },
        { name: 'Value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });

    await expect(transformDataFrame([cfg], [seriesA])).toEmitValuesWith((received) => {
      const processed = received[0];
      const expected: Field[] = [
        {
          name: 'Time\\Time',
          type: FieldType.time,
          values: [1000, 1001, 1002],
          config: {},
        },
        {
          name: '1000',
          type: FieldType.number,
          values: [1, '', ''],
          config: {},
        },
        {
          name: '1001',
          type: FieldType.number,
          values: ['', 2, ''],
          config: {},
        },
        {
          name: '1002',
          type: FieldType.number,
          values: ['', '', 3],
          config: {},
        },
      ];

      expect(processed[0].fields).toEqual(expected);
    });
  });

  it('generates Matrix with multiple fields', async () => {
    const cfg: DataTransformerConfig<GroupingToMatrixTransformerOptions> = {
      id: DataTransformerID.groupingToMatrix,
      options: {
        columnField: 'Column',
        rowField: 'Row',
        valueField: 'Temp',
      },
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Column', type: FieldType.string, values: ['C1', 'C1', 'C2'] },
        { name: 'Row', type: FieldType.string, values: ['R1', 'R2', 'R1'] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    await expect(transformDataFrame([cfg], [seriesA])).toEmitValuesWith((received) => {
      const processed = received[0];
      const expected: Field[] = [
        {
          name: 'Row\\Column',
          type: FieldType.string,
          values: ['R1', 'R2'],
          config: {},
        },
        {
          name: 'C1',
          type: FieldType.number,
          values: [1, 4],
          config: {},
        },
        {
          name: 'C2',
          type: FieldType.number,
          values: [5, ''],
          config: {},
        },
      ];

      expect(processed[0].fields).toEqual(expected);
    });
  });

  it.each([
    [undefined, ''],
    [SpecialValue.Null, null],
    [SpecialValue.False, false],
    [SpecialValue.True, true],
    [SpecialValue.Empty, ''],
    [SpecialValue.Zero, 0],
  ])('generates Matrix with empty entries', async (emptyValue, expectedValue) => {
    const cfg: DataTransformerConfig<GroupingToMatrixTransformerOptions> = {
      id: DataTransformerID.groupingToMatrix,
      options: {
        emptyValue: emptyValue,
      },
    };

    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1001] },
        { name: 'Value', type: FieldType.number, values: [1, 2] },
      ],
    });

    await expect(transformDataFrame([cfg], [seriesA])).toEmitValuesWith((received) => {
      const processed = received[0];
      const expected: Field[] = [
        {
          name: 'Time\\Time',
          type: FieldType.time,
          values: [1000, 1001],
          config: {},
        },
        {
          name: '1000',
          type: FieldType.number,
          values: [1, expectedValue],
          config: {},
        },
        {
          name: '1001',
          type: FieldType.number,
          values: [expectedValue, 2],
          config: {},
        },
      ];

      expect(processed[0].fields).toEqual(expected);
    });
  });

  it('properly handles null column name values', async () => {
    const cfg: DataTransformerConfig<GroupingToMatrixTransformerOptions> = {
      id: DataTransformerID.groupingToMatrix,
      options: {
        columnField: 'Column',
        rowField: 'Row',
        valueField: 'Temp',
      },
    };

    const seriesA = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Column', type: FieldType.string, values: ['C1', null, 'C2'] },
        { name: 'Row', type: FieldType.string, values: ['R1', 'R2', 'R1'] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5], config: { units: 'celsius' } },
      ],
    });

    await expect(transformDataFrame([cfg], [seriesA])).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed[0].fields).toMatchInlineSnapshot(`
        [
          {
            "config": {},
            "name": "Row\\Column",
            "type": "string",
            "values": [
              "R1",
              "R2",
            ],
          },
          {
            "config": {
              "units": "celsius",
            },
            "name": "C1",
            "type": "number",
            "values": [
              1,
              "",
            ],
          },
          {
            "config": {
              "units": "celsius",
            },
            "name": null,
            "type": "number",
            "values": [
              "",
              4,
            ],
          },
          {
            "config": {
              "units": "celsius",
            },
            "name": "C2",
            "type": "number",
            "values": [
              5,
              "",
            ],
          },
        ]
      `);
    });
  });

  it('generates Matrix with multiple fields and value type', async () => {
    const cfg: DataTransformerConfig<GroupingToMatrixTransformerOptions> = {
      id: DataTransformerID.groupingToMatrix,
      options: {
        columnField: 'Column',
        rowField: 'Row',
        valueField: 'Temp',
      },
    };

    const seriesA = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Column', type: FieldType.string, values: ['C1', 'C1', 'C2'] },
        { name: 'Row', type: FieldType.string, values: ['R1', 'R2', 'R1'] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5], config: { units: 'celsius' } },
      ],
    });

    await expect(transformDataFrame([cfg], [seriesA])).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed[0].fields).toMatchInlineSnapshot(`
        [
          {
            "config": {},
            "name": "Row\\Column",
            "type": "string",
            "values": [
              "R1",
              "R2",
            ],
          },
          {
            "config": {
              "units": "celsius",
            },
            "name": "C1",
            "type": "number",
            "values": [
              1,
              4,
            ],
          },
          {
            "config": {
              "units": "celsius",
            },
            "name": "C2",
            "type": "number",
            "values": [
              5,
              "",
            ],
          },
        ]
      `);
    });
  });
});
