import { toDataFrame } from '../../dataframe';
import { FieldType, DataTransformerConfig } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ArrayVector } from '../../vector';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { SeriesToColumnsOptions, seriesToColumnsTransformer } from './seriesToColumns';

describe('SeriesToColumns Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([seriesToColumnsTransformer]);
  });

  const everySecondSeries = toDataFrame({
    name: 'even',
    fields: [
      { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
      { name: 'temperature', type: FieldType.number, values: [10.3, 10.4, 10.5, 10.6] },
      { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
    ],
  });

  const everyOtherSecondSeries = toDataFrame({
    name: 'odd',
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 3000, 5000, 7000] },
      { name: 'temperature', type: FieldType.number, values: [11.1, 11.3, 11.5, 11.7] },
      { name: 'humidity', type: FieldType.number, values: [11000.1, 11000.3, 11000.5, 11000.7] },
    ],
  });

  it('joins by time field', async () => {
    const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
      id: DataTransformerID.seriesToColumns,
      options: {
        byField: 'time',
      },
    };

    await expect(transformDataFrame([cfg], [everySecondSeries, everyOtherSecondSeries])).toEmitValuesWith(
      (received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields).toMatchInlineSnapshot(`
          Array [
            Object {
              "config": Object {},
              "name": "time",
              "state": Object {},
              "type": "time",
              "values": Array [
                1000,
                3000,
                4000,
                5000,
                6000,
                7000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "even",
              },
              "name": "temperature",
              "state": Object {},
              "type": "number",
              "values": Array [
                undefined,
                10.3,
                10.4,
                10.5,
                10.6,
                undefined,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "even",
              },
              "name": "humidity",
              "state": Object {},
              "type": "number",
              "values": Array [
                undefined,
                10000.3,
                10000.4,
                10000.5,
                10000.6,
                undefined,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "odd",
              },
              "name": "temperature",
              "state": Object {},
              "type": "number",
              "values": Array [
                11.1,
                11.3,
                undefined,
                11.5,
                undefined,
                11.7,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "odd",
              },
              "name": "humidity",
              "state": Object {},
              "type": "number",
              "values": Array [
                11000.1,
                11000.3,
                undefined,
                11000.5,
                undefined,
                11000.7,
              ],
            },
          ]
        `);
      }
    );
  });

  it('joins by temperature field', async () => {
    const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
      id: DataTransformerID.seriesToColumns,
      options: {
        byField: 'temperature',
      },
    };

    await expect(transformDataFrame([cfg], [everySecondSeries, everyOtherSecondSeries])).toEmitValuesWith(
      (received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields).toMatchInlineSnapshot(`
          Array [
            Object {
              "config": Object {},
              "name": "temperature",
              "state": Object {},
              "type": "number",
              "values": Array [
                10.3,
                10.4,
                10.5,
                10.6,
                11.1,
                11.3,
                11.5,
                11.7,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "even",
              },
              "name": "time",
              "state": Object {
                "multipleFrames": true,
              },
              "type": "time",
              "values": Array [
                3000,
                4000,
                5000,
                6000,
                undefined,
                undefined,
                undefined,
                undefined,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "even",
              },
              "name": "humidity",
              "state": Object {},
              "type": "number",
              "values": Array [
                10000.3,
                10000.4,
                10000.5,
                10000.6,
                undefined,
                undefined,
                undefined,
                undefined,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "odd",
              },
              "name": "time",
              "state": Object {
                "multipleFrames": true,
              },
              "type": "time",
              "values": Array [
                undefined,
                undefined,
                undefined,
                undefined,
                1000,
                3000,
                5000,
                7000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "odd",
              },
              "name": "humidity",
              "state": Object {},
              "type": "number",
              "values": Array [
                undefined,
                undefined,
                undefined,
                undefined,
                11000.1,
                11000.3,
                11000.5,
                11000.7,
              ],
            },
          ]
        `);
      }
    );
  });

  it('joins by time field in reverse order', async () => {
    const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
      id: DataTransformerID.seriesToColumns,
      options: {
        byField: 'time',
      },
    };

    everySecondSeries.fields[0].values = new ArrayVector(everySecondSeries.fields[0].values.toArray().reverse());
    everySecondSeries.fields[1].values = new ArrayVector(everySecondSeries.fields[1].values.toArray().reverse());
    everySecondSeries.fields[2].values = new ArrayVector(everySecondSeries.fields[2].values.toArray().reverse());

    await expect(transformDataFrame([cfg], [everySecondSeries, everyOtherSecondSeries])).toEmitValuesWith(
      (received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields).toMatchInlineSnapshot(`
          Array [
            Object {
              "config": Object {},
              "name": "time",
              "state": Object {
                "multipleFrames": true,
              },
              "type": "time",
              "values": Array [
                1000,
                3000,
                4000,
                5000,
                6000,
                7000,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "even",
              },
              "name": "temperature",
              "state": Object {},
              "type": "number",
              "values": Array [
                undefined,
                10.3,
                10.4,
                10.5,
                10.6,
                undefined,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "even",
              },
              "name": "humidity",
              "state": Object {},
              "type": "number",
              "values": Array [
                undefined,
                10000.3,
                10000.4,
                10000.5,
                10000.6,
                undefined,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "odd",
              },
              "name": "temperature",
              "state": Object {},
              "type": "number",
              "values": Array [
                11.1,
                11.3,
                undefined,
                11.5,
                undefined,
                11.7,
              ],
            },
            Object {
              "config": Object {},
              "labels": Object {
                "name": "odd",
              },
              "name": "humidity",
              "state": Object {},
              "type": "number",
              "values": Array [
                11000.1,
                11000.3,
                undefined,
                11000.5,
                undefined,
                11000.7,
              ],
            },
          ]
        `);
      }
    );
  });

  describe('Field names', () => {
    const seriesWithSameFieldAndDataFrameName = toDataFrame({
      name: 'temperature',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
        { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000, 4000] },
        { name: 'temperature', type: FieldType.number, values: [2, 4, 6, 8] },
      ],
    });

    it('when dataframe and field share the same name then use the field name', async () => {
      const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
        id: DataTransformerID.seriesToColumns,
        options: {
          byField: 'time',
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithSameFieldAndDataFrameName, seriesB])).toEmitValuesWith(
        (received) => {
          const data = received[0];
          const filtered = data[0];
          expect(filtered.fields).toMatchInlineSnapshot(`
            Array [
              Object {
                "config": Object {},
                "name": "time",
                "state": Object {},
                "type": "time",
                "values": Array [
                  1000,
                  2000,
                  3000,
                  4000,
                ],
              },
              Object {
                "config": Object {},
                "labels": Object {
                  "name": "temperature",
                },
                "name": "temperature",
                "state": Object {},
                "type": "number",
                "values": Array [
                  1,
                  3,
                  5,
                  7,
                ],
              },
              Object {
                "config": Object {},
                "labels": Object {
                  "name": "B",
                },
                "name": "temperature",
                "state": Object {},
                "type": "number",
                "values": Array [
                  2,
                  4,
                  6,
                  8,
                ],
              },
            ]
          `);
        }
      );
    });
  });

  it('joins if fields are missing', async () => {
    const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
      id: DataTransformerID.seriesToColumns,
      options: {
        byField: 'time',
      },
    };

    const frame1 = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'temperature', type: FieldType.number, values: [10, 11, 12] },
      ],
    });

    const frame2 = toDataFrame({
      name: 'B',
      fields: [],
    });

    const frame3 = toDataFrame({
      name: 'C',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'temperature', type: FieldType.number, values: [20, 22, 24] },
      ],
    });

    await expect(transformDataFrame([cfg], [frame1, frame2, frame3])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      expect(filtered.fields).toMatchInlineSnapshot(`
        Array [
          Object {
            "config": Object {},
            "name": "time",
            "state": Object {},
            "type": "time",
            "values": Array [
              1,
              2,
              3,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "name": "A",
            },
            "name": "temperature",
            "state": Object {},
            "type": "number",
            "values": Array [
              10,
              11,
              12,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {
              "name": "C",
            },
            "name": "temperature",
            "state": Object {},
            "type": "number",
            "values": Array [
              20,
              22,
              24,
            ],
          },
        ]
      `);
    });
  });

  it('handles duplicate field name', async () => {
    const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
      id: DataTransformerID.seriesToColumns,
      options: {
        byField: 'time',
      },
    };

    const frame1 = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'temperature', type: FieldType.number, values: [10] },
      ],
    });

    const frame2 = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1] },
        { name: 'temperature', type: FieldType.number, values: [20] },
      ],
    });

    await expect(transformDataFrame([cfg], [frame1, frame2])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      expect(filtered.fields).toMatchInlineSnapshot(`
        Array [
          Object {
            "config": Object {},
            "name": "time",
            "state": Object {},
            "type": "time",
            "values": Array [
              1,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {},
            "name": "temperature",
            "state": Object {},
            "type": "number",
            "values": Array [
              10,
            ],
          },
          Object {
            "config": Object {},
            "labels": Object {},
            "name": "temperature",
            "state": Object {},
            "type": "number",
            "values": Array [
              20,
            ],
          },
        ]
      `);
    });
  });
});
