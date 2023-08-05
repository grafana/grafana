import { DataFrameView } from '../../dataframe';
import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataTransformerConfig, Field, FieldType } from '../../types';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { ReducerID } from '../fieldReducer';
import { notTimeFieldMatcher } from '../matchers/predicates';
import { transformDataFrame } from '../transformDataFrame';

import { DataTransformerID } from './ids';
import { reduceFields, reduceTransformer, ReduceTransformerOptions } from './reduce';

const seriesAWithSingleField = toDataFrame({
  name: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
    { name: 'temperature', type: FieldType.number, values: [3, 4, 5, 6] },
  ],
});

const seriesAWithMultipleFields = toDataFrame({
  name: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
    { name: 'temperature', type: FieldType.number, values: [3, 4, 5, 6] },
    { name: 'humidity', type: FieldType.number, values: [10000.3, 10000.4, 10000.5, 10000.6] },
  ],
});

const seriesBWithSingleField = toDataFrame({
  name: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 3000, 5000, 7000] },
    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
  ],
});

const seriesBWithMultipleFields = toDataFrame({
  name: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 3000, 5000, 7000] },
    { name: 'temperature', type: FieldType.number, values: [1, 3, 5, 7] },
    { name: 'humidity', type: FieldType.number, values: [11000.1, 11000.3, 11000.5, 11000.7] },
  ],
});

describe('Reducer Transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([reduceTransformer]);
  });

  it('reduces multiple data frames with many fields', async () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.last],
      },
    };

    await expect(transformDataFrame([cfg], [seriesAWithMultipleFields, seriesBWithMultipleFields])).toEmitValuesWith(
      (received) => {
        const processed = received[0];
        const expected: Field[] = [
          {
            name: 'Field',
            type: FieldType.string,
            values: ['A temperature', 'A humidity', 'B temperature', 'B humidity'],
            config: {},
          },
          {
            name: 'First',
            type: FieldType.number,
            values: [3, 10000.3, 1, 11000.1],
            config: {},
          },
          {
            name: 'Min',
            type: FieldType.number,
            values: [3, 10000.3, 1, 11000.1],
            config: {},
          },
          {
            name: 'Max',
            type: FieldType.number,
            values: [6, 10000.6, 7, 11000.7],
            config: {},
          },
          {
            name: 'Last',
            type: FieldType.number,
            values: [6, 10000.6, 7, 11000.7],
            config: {},
          },
        ];

        expect(processed.length).toEqual(1);
        expect(processed[0].length).toEqual(4);
        expect(processed[0].fields).toEqual(expected);
      }
    );
  });

  it('reduces multiple data frames with single field', async () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.last],
      },
    };

    await expect(transformDataFrame([cfg], [seriesAWithSingleField, seriesBWithSingleField])).toEmitValuesWith(
      (received) => {
        const processed = received[0];
        const expected: Field[] = [
          {
            name: 'Field',
            type: FieldType.string,
            values: ['A temperature', 'B temperature'],
            config: {},
          },
          {
            name: 'First',
            type: FieldType.number,
            values: [3, 1],
            config: {},
          },
          {
            name: 'Min',
            type: FieldType.number,
            values: [3, 1],
            config: {},
          },
          {
            name: 'Max',
            type: FieldType.number,
            values: [6, 7],
            config: {},
          },
          {
            name: 'Last',
            type: FieldType.number,
            values: [6, 7],
            config: {},
          },
        ];

        expect(processed.length).toEqual(1);
        expect(processed[0].length).toEqual(2);
        expect(processed[0].fields).toEqual(expected);
      }
    );
  });

  it('reduces single data frame with many fields', async () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.last],
      },
    };

    await expect(transformDataFrame([cfg], [seriesAWithMultipleFields])).toEmitValuesWith((received) => {
      const processed = received[0];
      const expected: Field[] = [
        {
          name: 'Field',
          type: FieldType.string,
          values: ['temperature', 'humidity'],
          config: {},
        },
        {
          name: 'First',
          type: FieldType.number,
          values: [3, 10000.3],
          config: {},
        },
        {
          name: 'Min',
          type: FieldType.number,
          values: [3, 10000.3],
          config: {},
        },
        {
          name: 'Max',
          type: FieldType.number,
          values: [6, 10000.6],
          config: {},
        },
        {
          name: 'Last',
          type: FieldType.number,
          values: [6, 10000.6],
          config: {},
        },
      ];

      expect(processed.length).toEqual(1);
      expect(processed[0].length).toEqual(2);
      expect(processed[0].fields).toEqual(expected);
    });
  });

  it('reduces single data frame with single field', async () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.first, ReducerID.min, ReducerID.max, ReducerID.last],
      },
    };

    await expect(transformDataFrame([cfg], [seriesAWithSingleField])).toEmitValuesWith((received) => {
      const processed = received[0];
      const expected: Field[] = [
        {
          name: 'Field',
          type: FieldType.string,
          values: ['temperature'],
          config: {},
        },
        {
          name: 'First',
          type: FieldType.number,
          values: [3],
          config: {},
        },
        {
          name: 'Min',
          type: FieldType.number,
          values: [3],
          config: {},
        },
        {
          name: 'Max',
          type: FieldType.number,
          values: [6],
          config: {},
        },
        {
          name: 'Last',
          type: FieldType.number,
          values: [6],
          config: {},
        },
      ];

      expect(processed.length).toEqual(1);
      expect(processed[0].length).toEqual(1);
      expect(processed[0].fields).toEqual(expected);
    });
  });

  it('reduces fields with single calculator', () => {
    const frames = reduceFields(
      [seriesAWithSingleField, seriesAWithMultipleFields], // data
      notTimeFieldMatcher, // skip time fields
      [ReducerID.last] // only one
    );

    // Convert each frame to a structure with the same fields
    expect(frames.length).toEqual(2);
    expect(frames[0].length).toEqual(1);
    expect(frames[1].length).toEqual(1);

    const view0 = new DataFrameView(frames[0]);
    const view1 = new DataFrameView(frames[1]);
    expect({ ...view0.get(0) }).toMatchInlineSnapshot(`
      {
        "temperature": 6,
      }
    `);
    expect({ ...view1.get(0) }).toMatchInlineSnapshot(`
      {
        "humidity": 10000.6,
        "temperature": 6,
      }
    `);
  });

  it('reduces multiple data frames with decimal display name (https://github.com/grafana/grafana/issues/31580)', async () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.max],
      },
    };

    const seriesA = toDataFrame({
      name: 'a',
      fields: [
        { name: 'Time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'Value', type: FieldType.number, values: [3, 4, 5, 6] },
      ],
    });

    const seriesB = toDataFrame({
      name: '2021',
      fields: [
        { name: 'Time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'Value', type: FieldType.number, values: [7, 8, 9, 10] },
      ],
    });

    await expect(transformDataFrame([cfg], [seriesA, seriesB])).toEmitValuesWith((received) => {
      const processed = received[0];
      const expected: Field[] = [
        {
          name: 'Field',
          type: FieldType.string,
          values: ['a', '2021'],
          config: {},
        },
        {
          name: 'Max',
          type: FieldType.number,
          values: [6, 10],
          config: {},
        },
      ];

      expect(processed.length).toEqual(1);
      expect(processed[0].length).toEqual(2);
      expect(processed[0].fields).toEqual(expected);
    });
  });

  it('reduces multiple data frames with decimal fields name (https://github.com/grafana/grafana/issues/31580)', async () => {
    const cfg = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.max],
      },
    };

    const seriesA = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'a', type: FieldType.number, values: [3, 4, 5, 6] },
      ],
    });

    const seriesB = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: '2021', type: FieldType.number, values: [7, 8, 9, 10] },
      ],
    });

    await expect(transformDataFrame([cfg], [seriesA, seriesB])).toEmitValuesWith((received) => {
      const processed = received[0];
      const expected: Field[] = [
        {
          name: 'Field',
          type: FieldType.string,
          values: ['a', '2021'],
          config: {},
        },
        {
          name: 'Max',
          type: FieldType.number,
          values: [6, 10],
          config: {},
        },
      ];

      expect(processed.length).toEqual(1);
      expect(processed[0].length).toEqual(2);
      expect(processed[0].fields).toEqual(expected);
    });
  });

  it('reduces keeping label field', async () => {
    const cfg: DataTransformerConfig<ReduceTransformerOptions> = {
      id: DataTransformerID.reduce,
      options: {
        reducers: [ReducerID.max],
        labelsToFields: true,
      },
    };

    const seriesA = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'value', labels: { state: 'CA' }, type: FieldType.number, values: [3, 4, 5, 6] },
        { name: 'value', labels: { state: 'NY' }, type: FieldType.number, values: [3, 4, 5, 6] },
      ],
    });

    const seriesB = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [3000, 4000, 5000, 6000] },
        { name: 'value', labels: { state: 'CA', country: 'USA' }, type: FieldType.number, values: [3, 4, 5, 6] },
        { name: 'value', labels: { country: 'USA' }, type: FieldType.number, values: [3, 4, 5, 6] },
      ],
    });

    await expect(transformDataFrame([cfg], [seriesA, seriesB])).toEmitValuesWith((received) => {
      const processed = received[0];

      expect(processed.length).toEqual(1);
      expect(processed[0].fields).toMatchInlineSnapshot(`
        [
          {
            "config": {},
            "name": "Field",
            "type": "string",
            "values": [
              "value",
              "value",
              "value",
              "value",
            ],
          },
          {
            "config": {},
            "name": "state",
            "type": "string",
            "values": [
              "CA",
              "NY",
              "CA",
              ,
            ],
          },
          {
            "config": {},
            "name": "country",
            "type": "string",
            "values": [
              ,
              ,
              "USA",
              "USA",
            ],
          },
          {
            "config": {},
            "name": "Max",
            "type": "number",
            "values": [
              6,
              6,
              6,
              6,
            ],
          },
        ]
      `);
    });
  });
});
