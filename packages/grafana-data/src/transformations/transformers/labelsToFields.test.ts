import { Subscription } from 'rxjs';

import { toDataFrame, toDataFrameDTO } from '../../dataframe';
import { DataFrame, DataTransformerConfig, FieldDTO, FieldType } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { LabelsToFieldsMode, LabelsToFieldsOptions, labelsToFieldsTransformer } from './labelsToFields';

function labelsToFieldTransform(source: DataFrame[]): Promise<DataFrame[]> {
  const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
    id: DataTransformerID.labelsToFields,
    options: {
      mode: LabelsToFieldsMode.Rows,
    },
  };

  const observable = transformDataFrame([cfg], source);

  return new Promise((resolve, reject) => {
    const subscription = new Subscription();

    subscription.add(
      observable.subscribe({
        next: (value) => {
          subscription.unsubscribe();
          resolve(JSON.parse(JSON.stringify(value)));
        },
        error: (err) => {
          subscription.unsubscribe();
          reject(err);
        },
      })
    );
  });
}

describe('Labels as Columns', () => {
  beforeAll(() => {
    mockTransformationsRegistry([labelsToFieldsTransformer]);
  });

  it('transform keep the refId of dataFrames', async () => {
    const input = [
      toDataFrame({
        refId: 'the-ref-id-A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'Value', type: FieldType.number, values: [1, 2], labels: { labelA: 'valueA', labelB: 'valueB' } },
        ],
      }),
      toDataFrame({
        refId: 'the-ref-id-B',
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000] },
          { name: 'Value', type: FieldType.number, values: [1, 2], labels: { labelA: 'valueA', labelB: 'valueB' } },
        ],
      }),
    ];

    const output = await labelsToFieldTransform(input);

    const expectedOutput = [
      {
        refId: 'the-ref-id-A',
      },
      {
        refId: 'the-ref-id-B',
      },
    ];

    for (let i = 0; i < output.length; i++) {
      expect(output[i]).toMatchObject(expectedOutput[i]);
    }
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
        {
          "Value": ArrayVector [
            1,
            2,
          ],
          "feelsLike": ArrayVector [
            "ok",
            "ok",
          ],
          "location": ArrayVector [
            "inside",
            "inside",
          ],
          "time": ArrayVector [
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
        {
          "location": ArrayVector [
            "inside",
          ],
          "temp": ArrayVector [
            1,
          ],
          "time": ArrayVector [
            1000,
          ],
        }
      `);
      expect(toSimpleObject(data[1])).toMatchInlineSnapshot(`
        {
          "location": ArrayVector [
            "outside",
          ],
          "temp": ArrayVector [
            -1,
          ],
          "time": ArrayVector [
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

  it('filter labels from source', async () => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {
        keepLabels: ['foo', 'bar'],
      },
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'a', type: FieldType.number, values: [1, 3], labels: { foo: 'thing', x: 'hide', y: 'z' } },
        { name: 'b', type: FieldType.number, values: [2, 4], labels: { bar: 'thing', a: 'nope' } },
      ],
    });

    await expect(transformDataFrame([cfg], [source])).toEmitValuesWith((received) => {
      expect(received[0][0].fields.map((f) => ({ [f.name]: f.values.toArray() }))).toMatchInlineSnapshot(`
        [
          {
            "time": ArrayVector [
              1000,
              2000,
            ],
          },
          {
            "a": ArrayVector [
              1,
              3,
            ],
          },
          {
            "b": ArrayVector [
              2,
              4,
            ],
          },
          {
            "foo": ArrayVector [
              "thing",
              "thing",
            ],
          },
          {
            "bar": ArrayVector [
              "thing",
              "thing",
            ],
          },
        ]
      `);
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

  it('Show labels as rows', async () => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {
        mode: LabelsToFieldsMode.Rows,
      },
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'a', type: FieldType.number, values: [1, 3], labels: { foo: 'thing', bar: 'a', zaz: 'xyz' } },
        { name: 'b', type: FieldType.number, values: [2, 4], labels: { foo: 'thing', bar: 'b' } },
      ],
    });

    await expect(transformDataFrame([cfg], [source])).toEmitValuesWith((received) => {
      expect(
        received[0].map((f) => ({ name: f.name, fields: f.fields.map((v) => ({ [v.name]: v.values.toArray() })) }))
      ).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "label": ArrayVector [
                  "foo",
                  "bar",
                  "zaz",
                ],
              },
              {
                "value": ArrayVector [
                  "thing",
                  "a",
                  "xyz",
                ],
              },
            ],
            "name": "a {bar="a", foo="thing", zaz="xyz"}",
          },
          {
            "fields": [
              {
                "label": ArrayVector [
                  "foo",
                  "bar",
                ],
              },
              {
                "value": ArrayVector [
                  "thing",
                  "b",
                ],
              },
            ],
            "name": "b {bar="b", foo="thing"}",
          },
        ]
      `);
    });
  });

  it('Show labels as rows (and filter)', async () => {
    const cfg: DataTransformerConfig<LabelsToFieldsOptions> = {
      id: DataTransformerID.labelsToFields,
      options: {
        mode: LabelsToFieldsMode.Rows,
        keepLabels: ['zaz', 'bar'],
      },
    };

    const source = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'a', type: FieldType.number, values: [1, 3], labels: { foo: 'thing', bar: 'a', zaz: 'xyz' } },
        { name: 'b', type: FieldType.number, values: [2, 4], labels: { foo: 'thing', bar: 'b' } },
      ],
    });

    await expect(transformDataFrame([cfg], [source])).toEmitValuesWith((received) => {
      expect(
        received[0].map((f) => ({ name: f.name, fields: f.fields.map((v) => ({ [v.name]: v.values.toArray() })) }))
      ).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "label": ArrayVector [
                  "zaz",
                  "bar",
                ],
              },
              {
                "value": ArrayVector [
                  "xyz",
                  "a",
                ],
              },
            ],
            "name": "a {bar="a", foo="thing", zaz="xyz"}",
          },
          {
            "fields": [
              {
                "label": ArrayVector [
                  "zaz",
                  "bar",
                ],
              },
              {
                "value": ArrayVector [
                  undefined,
                  "b",
                ],
              },
            ],
            "name": "b {bar="b", foo="thing"}",
          },
        ]
      `);
    });
  });
});

function toSimpleObject(frame: DataFrame) {
  const obj: Record<string, unknown> = {};
  for (const field of frame.fields) {
    obj[field.name] = field.values.toArray();
  }
  return obj;
}
