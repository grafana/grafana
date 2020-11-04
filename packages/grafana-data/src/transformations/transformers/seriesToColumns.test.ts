import {
  ArrayVector,
  DataTransformerConfig,
  DataTransformerID,
  Field,
  FieldType,
  toDataFrame,
  transformDataFrame,
} from '@grafana/data';
import { SeriesToColumnsOptions, seriesToColumnsTransformer } from './seriesToColumns';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { observableTester } from '../../utils/tests/observableTester';

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

  it('joins by time field', done => {
    const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
      id: DataTransformerID.seriesToColumns,
      options: {
        byField: 'time',
      },
    };

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [everySecondSeries, everyOtherSecondSeries]),
      expect: data => {
        const filtered = data[0];
        expect(filtered.fields).toEqual([
          {
            name: 'time',
            state: {
              displayName: 'time',
            },
            type: FieldType.time,
            values: new ArrayVector([1000, 3000, 4000, 5000, 6000, 7000]),
            config: {},
            labels: undefined,
          },
          {
            name: 'temperature',
            state: {
              displayName: 'temperature even',
            },
            type: FieldType.number,
            values: new ArrayVector([null, 10.3, 10.4, 10.5, 10.6, null]),
            config: {},
            labels: { name: 'even' },
          },
          {
            name: 'humidity',
            state: {
              displayName: 'humidity even',
            },
            type: FieldType.number,
            values: new ArrayVector([null, 10000.3, 10000.4, 10000.5, 10000.6, null]),
            config: {},
            labels: { name: 'even' },
          },
          {
            name: 'temperature',
            state: {
              displayName: 'temperature odd',
            },
            type: FieldType.number,
            values: new ArrayVector([11.1, 11.3, null, 11.5, null, 11.7]),
            config: {},
            labels: { name: 'odd' },
          },
          {
            name: 'humidity',
            state: {
              displayName: 'humidity odd',
            },
            type: FieldType.number,
            values: new ArrayVector([11000.1, 11000.3, null, 11000.5, null, 11000.7]),
            config: {},
            labels: { name: 'odd' },
          },
        ]);
      },
      done,
    });
  });

  it('joins by temperature field', done => {
    const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
      id: DataTransformerID.seriesToColumns,
      options: {
        byField: 'temperature',
      },
    };

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [everySecondSeries, everyOtherSecondSeries]),
      expect: data => {
        const filtered = data[0];
        expect(filtered.fields).toEqual([
          {
            name: 'temperature',
            state: {
              displayName: 'temperature',
            },
            type: FieldType.number,
            values: new ArrayVector([10.3, 10.4, 10.5, 10.6, 11.1, 11.3, 11.5, 11.7]),
            config: {},
            labels: undefined,
          },
          {
            name: 'time',
            state: {
              displayName: 'time even',
            },
            type: FieldType.time,
            values: new ArrayVector([3000, 4000, 5000, 6000, null, null, null, null]),
            config: {},
            labels: { name: 'even' },
          },
          {
            name: 'humidity',
            state: {
              displayName: 'humidity even',
            },
            type: FieldType.number,
            values: new ArrayVector([10000.3, 10000.4, 10000.5, 10000.6, null, null, null, null]),
            config: {},
            labels: { name: 'even' },
          },
          {
            name: 'time',
            state: {
              displayName: 'time odd',
            },
            type: FieldType.time,
            values: new ArrayVector([null, null, null, null, 1000, 3000, 5000, 7000]),
            config: {},
            labels: { name: 'odd' },
          },
          {
            name: 'humidity',
            state: {
              displayName: 'humidity odd',
            },
            type: FieldType.number,
            values: new ArrayVector([null, null, null, null, 11000.1, 11000.3, 11000.5, 11000.7]),
            config: {},
            labels: { name: 'odd' },
          },
        ]);
      },
      done,
    });
  });

  it('joins by time field in reverse order', done => {
    const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
      id: DataTransformerID.seriesToColumns,
      options: {
        byField: 'time',
      },
    };

    everySecondSeries.fields[0].values = new ArrayVector(everySecondSeries.fields[0].values.toArray().reverse());
    everySecondSeries.fields[1].values = new ArrayVector(everySecondSeries.fields[1].values.toArray().reverse());
    everySecondSeries.fields[2].values = new ArrayVector(everySecondSeries.fields[2].values.toArray().reverse());

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [everySecondSeries, everyOtherSecondSeries]),
      expect: data => {
        const filtered = data[0];
        expect(filtered.fields).toEqual([
          {
            name: 'time',
            state: {
              displayName: 'time',
            },
            type: FieldType.time,
            values: new ArrayVector([1000, 3000, 4000, 5000, 6000, 7000]),
            config: {},
            labels: undefined,
          },
          {
            name: 'temperature',
            state: {
              displayName: 'temperature even',
            },
            type: FieldType.number,
            values: new ArrayVector([null, 10.3, 10.4, 10.5, 10.6, null]),
            config: {},
            labels: { name: 'even' },
          },
          {
            name: 'humidity',
            state: {
              displayName: 'humidity even',
            },
            type: FieldType.number,
            values: new ArrayVector([null, 10000.3, 10000.4, 10000.5, 10000.6, null]),
            config: {},
            labels: { name: 'even' },
          },
          {
            name: 'temperature',
            state: {
              displayName: 'temperature odd',
            },
            type: FieldType.number,
            values: new ArrayVector([11.1, 11.3, null, 11.5, null, 11.7]),
            config: {},
            labels: { name: 'odd' },
          },
          {
            name: 'humidity',
            state: {
              displayName: 'humidity odd',
            },
            type: FieldType.number,
            values: new ArrayVector([11000.1, 11000.3, null, 11000.5, null, 11000.7]),
            config: {},
            labels: { name: 'odd' },
          },
        ]);
      },
      done,
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

    it('when dataframe and field share the same name then use the field name', done => {
      const cfg: DataTransformerConfig<SeriesToColumnsOptions> = {
        id: DataTransformerID.seriesToColumns,
        options: {
          byField: 'time',
        },
      };

      observableTester().subscribeAndExpectOnNext({
        observable: transformDataFrame([cfg], [seriesWithSameFieldAndDataFrameName, seriesB]),
        expect: data => {
          const filtered = data[0];
          const expected: Field[] = [
            {
              name: 'time',
              state: {
                displayName: 'time',
              },
              type: FieldType.time,
              values: new ArrayVector([1000, 2000, 3000, 4000]),
              config: {},
              labels: undefined,
            },
            {
              name: 'temperature',
              type: FieldType.number,
              values: new ArrayVector([1, 3, 5, 7]),
              config: {},
              state: {
                displayName: 'temperature temperature',
              },
              labels: { name: 'temperature' },
            },
            {
              name: 'temperature',
              state: {
                displayName: 'temperature B',
              },
              type: FieldType.number,
              values: new ArrayVector([2, 4, 6, 8]),
              config: {},
              labels: { name: 'B' },
            },
          ];

          expect(filtered.fields).toEqual(expected);
        },
        done,
      });
    });
  });

  it('joins if fields are missing', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [frame1, frame2, frame3]),
      expect: data => {
        const filtered = data[0];
        expect(filtered.fields).toEqual([
          {
            name: 'time',
            state: { displayName: 'time' },
            type: FieldType.time,
            values: new ArrayVector([1, 2, 3]),
            config: {},
          },
          {
            name: 'temperature',
            state: { displayName: 'temperature A' },
            type: FieldType.number,
            values: new ArrayVector([10, 11, 12]),
            config: {},
            labels: { name: 'A' },
          },
          {
            name: 'temperature',
            state: { displayName: 'temperature C' },
            type: FieldType.number,
            values: new ArrayVector([20, 22, 24]),
            config: {},
            labels: { name: 'C' },
          },
        ]);
      },
      done,
    });
  });

  it('handles duplicate field name', done => {
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

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [frame1, frame2]),
      expect: data => {
        const filtered = data[0];
        expect(filtered.fields).toEqual([
          {
            name: 'time',
            state: { displayName: 'time' },
            type: FieldType.time,
            values: new ArrayVector([1]),
            config: {},
          },
          {
            name: 'temperature',
            state: { displayName: 'temperature 1' },
            type: FieldType.number,
            values: new ArrayVector([10]),
            config: {},
            labels: {},
          },
          {
            name: 'temperature',
            state: { displayName: 'temperature 2' },
            type: FieldType.number,
            values: new ArrayVector([20]),
            config: {},
            labels: {},
          },
        ]);
      },
      done,
    });
  });
});
