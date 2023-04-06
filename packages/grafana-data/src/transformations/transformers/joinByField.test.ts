import { toDataFrame } from '../../dataframe';
import { FieldType, DataTransformerConfig } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ArrayVector } from '../../vector';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { JoinMode, JoinByFieldOptions, joinByFieldTransformer } from './joinByField';

describe('JOIN Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([joinByFieldTransformer]);
  });

  describe('outer join', () => {
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
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
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
            [
              {
                "config": {},
                "name": "time",
                "state": {},
                "type": "time",
                "values": ArrayVector [
                  1000,
                  3000,
                  4000,
                  5000,
                  6000,
                  7000,
                ],
              },
              {
                "config": {},
                "labels": {
                  "name": "even",
                },
                "name": "temperature",
                "state": {},
                "type": "number",
                "values": ArrayVector [
                  undefined,
                  10.3,
                  10.4,
                  10.5,
                  10.6,
                  undefined,
                ],
              },
              {
                "config": {},
                "labels": {
                  "name": "even",
                },
                "name": "humidity",
                "state": {},
                "type": "number",
                "values": ArrayVector [
                  undefined,
                  10000.3,
                  10000.4,
                  10000.5,
                  10000.6,
                  undefined,
                ],
              },
              {
                "config": {},
                "labels": {
                  "name": "odd",
                },
                "name": "temperature",
                "state": {},
                "type": "number",
                "values": ArrayVector [
                  11.1,
                  11.3,
                  undefined,
                  11.5,
                  undefined,
                  11.7,
                ],
              },
              {
                "config": {},
                "labels": {
                  "name": "odd",
                },
                "name": "humidity",
                "state": {},
                "type": "number",
                "values": ArrayVector [
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
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
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
            [
              {
                "config": {},
                "name": "temperature",
                "state": {},
                "type": "number",
                "values": ArrayVector [
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
              {
                "config": {},
                "labels": {
                  "name": "even",
                },
                "name": "time",
                "state": {
                  "multipleFrames": true,
                },
                "type": "time",
                "values": ArrayVector [
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
              {
                "config": {},
                "labels": {
                  "name": "even",
                },
                "name": "humidity",
                "state": {},
                "type": "number",
                "values": ArrayVector [
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
              {
                "config": {},
                "labels": {
                  "name": "odd",
                },
                "name": "time",
                "state": {
                  "multipleFrames": true,
                },
                "type": "time",
                "values": ArrayVector [
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
              {
                "config": {},
                "labels": {
                  "name": "odd",
                },
                "name": "humidity",
                "state": {},
                "type": "number",
                "values": ArrayVector [
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
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
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
            [
              {
                "config": {},
                "name": "time",
                "state": {
                  "multipleFrames": true,
                },
                "type": "time",
                "values": ArrayVector [
                  1000,
                  3000,
                  4000,
                  5000,
                  6000,
                  7000,
                ],
              },
              {
                "config": {},
                "labels": {
                  "name": "even",
                },
                "name": "temperature",
                "state": {},
                "type": "number",
                "values": ArrayVector [
                  undefined,
                  10.3,
                  10.4,
                  10.5,
                  10.6,
                  undefined,
                ],
              },
              {
                "config": {},
                "labels": {
                  "name": "even",
                },
                "name": "humidity",
                "state": {},
                "type": "number",
                "values": ArrayVector [
                  undefined,
                  10000.3,
                  10000.4,
                  10000.5,
                  10000.6,
                  undefined,
                ],
              },
              {
                "config": {},
                "labels": {
                  "name": "odd",
                },
                "name": "temperature",
                "state": {},
                "type": "number",
                "values": ArrayVector [
                  11.1,
                  11.3,
                  undefined,
                  11.5,
                  undefined,
                  11.7,
                ],
              },
              {
                "config": {},
                "labels": {
                  "name": "odd",
                },
                "name": "humidity",
                "state": {},
                "type": "number",
                "values": ArrayVector [
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
        const cfg: DataTransformerConfig<JoinByFieldOptions> = {
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
              [
                {
                  "config": {},
                  "name": "time",
                  "state": {},
                  "type": "time",
                  "values": ArrayVector [
                    1000,
                    2000,
                    3000,
                    4000,
                  ],
                },
                {
                  "config": {},
                  "labels": {
                    "name": "temperature",
                  },
                  "name": "temperature",
                  "state": {},
                  "type": "number",
                  "values": ArrayVector [
                    1,
                    3,
                    5,
                    7,
                  ],
                },
                {
                  "config": {},
                  "labels": {
                    "name": "B",
                  },
                  "name": "temperature",
                  "state": {},
                  "type": "number",
                  "values": ArrayVector [
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
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
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
          [
            {
              "config": {},
              "name": "time",
              "state": {},
              "type": "time",
              "values": ArrayVector [
                1,
                2,
                3,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "A",
              },
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10,
                11,
                12,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "C",
              },
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
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
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
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
          [
            {
              "config": {},
              "name": "time",
              "state": {},
              "type": "time",
              "values": ArrayVector [
                1,
              ],
            },
            {
              "config": {},
              "labels": {},
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10,
              ],
            },
            {
              "config": {},
              "labels": {},
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                20,
              ],
            },
          ]
        `);
      });
    });
  });

  describe('inner join', () => {
    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'temperature', type: FieldType.number, values: [10.3, 10.4, 10.5, 10.6] },
        { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 3000, 5000, 7000] },
        { name: 'temperature', type: FieldType.number, values: [11.1, 10.3, 10.5, 11.7] },
        { name: 'humidity', type: FieldType.number, values: [11000.1, 10000.3, 10000.5, 11000.7] },
      ],
    });

    it('inner joins by time field', async () => {
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
        id: DataTransformerID.seriesToColumns,
        options: {
          byField: 'time',
          mode: JoinMode.inner,
        },
      };

      await expect(transformDataFrame([cfg], [seriesA, seriesB])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields).toMatchInlineSnapshot(`
          [
            {
              "config": {},
              "name": "time",
              "state": {},
              "type": "time",
              "values": ArrayVector [
                3000,
                5000,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "A",
              },
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10.3,
                10.5,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "A",
              },
              "name": "humidity",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10000.3,
                10000.5,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "B",
              },
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10.3,
                10.5,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "B",
              },
              "name": "humidity",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10000.3,
                10000.5,
              ],
            },
          ]
        `);
      });
    });

    it('inner joins by temperature field', async () => {
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
        id: DataTransformerID.seriesToColumns,
        options: {
          byField: 'temperature',
          mode: JoinMode.inner,
        },
      };

      await expect(transformDataFrame([cfg], [seriesA, seriesB])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields).toMatchInlineSnapshot(`
          [
            {
              "config": {},
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10.3,
                10.5,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "A",
              },
              "name": "time",
              "state": {
                "multipleFrames": true,
              },
              "type": "time",
              "values": ArrayVector [
                3000,
                5000,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "A",
              },
              "name": "humidity",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10000.3,
                10000.5,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "B",
              },
              "name": "time",
              "state": {
                "multipleFrames": true,
              },
              "type": "time",
              "values": ArrayVector [
                3000,
                5000,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "B",
              },
              "name": "humidity",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10000.3,
                10000.5,
              ],
            },
          ]
        `);
      });
    });

    it('inner joins by time field in reverse order', async () => {
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
        id: DataTransformerID.seriesToColumns,
        options: {
          byField: 'time',
          mode: JoinMode.inner,
        },
      };

      seriesA.fields[0].values = new ArrayVector(seriesA.fields[0].values.toArray().reverse());
      seriesA.fields[1].values = new ArrayVector(seriesA.fields[1].values.toArray().reverse());
      seriesA.fields[2].values = new ArrayVector(seriesA.fields[2].values.toArray().reverse());

      await expect(transformDataFrame([cfg], [seriesA, seriesB])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields).toMatchInlineSnapshot(`
          [
            {
              "config": {},
              "name": "time",
              "state": {
                "multipleFrames": true,
              },
              "type": "time",
              "values": ArrayVector [
                3000,
                5000,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "A",
              },
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10.3,
                10.5,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "A",
              },
              "name": "humidity",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10000.3,
                10000.5,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "B",
              },
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10.3,
                10.5,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "B",
              },
              "name": "humidity",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10000.3,
                10000.5,
              ],
            },
          ]
        `);
      });
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
        const cfg: DataTransformerConfig<JoinByFieldOptions> = {
          id: DataTransformerID.seriesToColumns,
          options: {
            byField: 'time',
            mode: JoinMode.inner,
          },
        };

        await expect(transformDataFrame([cfg], [seriesWithSameFieldAndDataFrameName, seriesB])).toEmitValuesWith(
          (received) => {
            const data = received[0];
            const filtered = data[0];
            expect(filtered.fields).toMatchInlineSnapshot(`
              [
                {
                  "config": {},
                  "name": "time",
                  "state": {},
                  "type": "time",
                  "values": ArrayVector [
                    1000,
                    2000,
                    3000,
                    4000,
                  ],
                },
                {
                  "config": {},
                  "labels": {
                    "name": "temperature",
                  },
                  "name": "temperature",
                  "state": {},
                  "type": "number",
                  "values": ArrayVector [
                    1,
                    3,
                    5,
                    7,
                  ],
                },
                {
                  "config": {},
                  "labels": {
                    "name": "B",
                  },
                  "name": "temperature",
                  "state": {},
                  "type": "number",
                  "values": ArrayVector [
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
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
        id: DataTransformerID.seriesToColumns,
        options: {
          byField: 'time',
          mode: JoinMode.inner,
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
          [
            {
              "config": {},
              "name": "time",
              "state": {},
              "type": "time",
              "values": ArrayVector [
                1,
                2,
                3,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "A",
              },
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10,
                11,
                12,
              ],
            },
            {
              "config": {},
              "labels": {
                "name": "C",
              },
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
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
      const cfg: DataTransformerConfig<JoinByFieldOptions> = {
        id: DataTransformerID.seriesToColumns,
        options: {
          byField: 'time',
          mode: JoinMode.inner,
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
          [
            {
              "config": {},
              "name": "time",
              "state": {},
              "type": "time",
              "values": ArrayVector [
                1,
              ],
            },
            {
              "config": {},
              "labels": {},
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                10,
              ],
            },
            {
              "config": {},
              "labels": {},
              "name": "temperature",
              "state": {},
              "type": "number",
              "values": ArrayVector [
                20,
              ],
            },
          ]
        `);
      });
    });
  });
});
