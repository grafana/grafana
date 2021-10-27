import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { LabelsToFieldsOptions, labelsToFieldsTransformer } from './labelsToFields';
import { DataFrame, DataTransformerConfig, FieldDTO, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame, toDataFrameDTO } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';

describe('Labels as Columns', () => {
  beforeAll(() => {
    mockTransformationsRegistry([labelsToFieldsTransformer]);
  });

  it('data frame with two labels', async () => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {},
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [1, 2], labels: { location: 'inside', feelsLike: 'ok' } },
      ],
    });

    await expect(transformDataFrame([cfg], [source])).toEmitValuesWith((received) => {
      const data = received[0];
      expect(toSimpleObject(data[0])).toMatchInlineSnapshot(`
        Object {
          "Value": Array [
            1,
            2,
          ],
          "feelsLike": Array [
            "ok",
            "ok",
          ],
          "location": Array [
            "inside",
            "inside",
          ],
          "time": Array [
            1000,
            2000,
          ],
        }
      `);
    });
  });

  it('data frame with two labels and valueLabel option', async () => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: { valueLabel: 'name' },
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [1, 2],
          labels: { location: 'inside', name: 'Request' },
          config: {
            displayName: 'Custom1',
            displayNameFromDS: 'Custom2',
          },
        },
      ],
    });

    await expect(transformDataFrame([cfg], [source])).toEmitValuesWith((received) => {
      const data = received[0];
      const result = toDataFrameDTO(data[0]);

      const expected: FieldDTO[] = [
        { name: 'time', type: FieldType.time, values: [1000, 2000], config: {} },
        { name: 'Request', type: FieldType.number, values: [1, 2], config: {} },
        {
          name: 'location',
          type: FieldType.string,
          values: ['inside', 'inside'],
          config: {},
        },
      ];

      expect(result.fields).toEqual(expected);
    });
  });

  it('two data frames with 1 value and 1 label', async () => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {},
    };

    const oneValueOneLabelA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000] },
        { name: 'temp', type: FieldType.number, values: [1], labels: { location: 'inside' } },
      ],
    });

    const oneValueOneLabelB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [2000] },
        { name: 'temp', type: FieldType.number, values: [-1], labels: { location: 'outside' } },
      ],
    });

    await expect(transformDataFrame([cfg], [oneValueOneLabelA, oneValueOneLabelB])).toEmitValuesWith((received) => {
      const data = received[0];
      expect(data.length).toEqual(2);

      expect(toSimpleObject(data[0])).toMatchInlineSnapshot(`
        Object {
          "location": Array [
            "inside",
          ],
          "temp": Array [
            1,
          ],
          "time": Array [
            1000,
          ],
        }
      `);
      expect(toSimpleObject(data[1])).toMatchInlineSnapshot(`
        Object {
          "location": Array [
            "outside",
          ],
          "temp": Array [
            -1,
          ],
          "time": Array [
            2000,
          ],
        }
      `);
    });
  });

  it('data frame with labels and multiple fields', async () => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {},
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'a', type: FieldType.number, values: [1, 3], labels: { name: 'thing' } },
        { name: 'b', type: FieldType.number, values: [2, 4], labels: { name: 'thing' } },
      ],
    });

    await expect(transformDataFrame([cfg], [source])).toEmitValuesWith((received) => {
      const data = received[0];
      const result = toDataFrameDTO(data[0]);

      const expected: FieldDTO[] = [
        { name: 'time', type: FieldType.time, values: [1000, 2000], config: {} },
        { name: 'a', type: FieldType.number, values: [1, 3], config: {} },
        { name: 'b', type: FieldType.number, values: [2, 4], config: {} },
        { name: 'name', type: FieldType.string, values: ['thing', 'thing'], config: {} },
      ];

      expect(result.fields).toEqual(expected);
    });
  });

  it('data frame with labels and multiple fields with different labels', async () => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {},
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'a', type: FieldType.number, values: [1, 3], labels: { name: 'thing', field: 'a' } },
        { name: 'b', type: FieldType.number, values: [2, 4], labels: { name: 'thing', field: 'b' } },
      ],
    });

    await expect(transformDataFrame([cfg], [source])).toEmitValuesWith((received) => {
      const data = received[0];
      const result = toDataFrameDTO(data[0]);

      const expected: FieldDTO[] = [
        { name: 'time', type: FieldType.time, values: [1000, 2000], config: {} },
        { name: 'a', type: FieldType.number, values: [1, 3], config: {} },
        { name: 'b', type: FieldType.number, values: [2, 4], config: {} },
        { name: 'name', type: FieldType.string, values: ['thing', 'thing'], config: {} },
        { name: 'field', type: FieldType.string, values: ['a', 'a'], config: {} },
        { name: 'field', type: FieldType.string, values: ['b', 'b'], config: {} },
      ];

      expect(result.fields).toEqual(expected);
    });
  });
});

function toSimpleObject(frame: DataFrame) {
  const obj: any = {};
  for (const field of frame.fields) {
    obj[field.name] = field.values.toArray();
  }
  return obj;
}
