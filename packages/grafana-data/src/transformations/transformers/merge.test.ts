import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { DataTransformerConfig, DisplayProcessor, Field, FieldType } from '../../types';
import { DataTransformerID } from './ids';
import { toDataFrame } from '../../dataframe';
import { transformDataFrame } from '../transformDataFrame';
import { ArrayVector } from '../../vector';
import { mergeTransformer, MergeTransformerOptions } from './merge';
import { observableTester } from '../../utils/tests/observableTester';

describe('Merge multipe to single', () => {
  const cfg: DataTransformerConfig<MergeTransformerOptions> = {
    id: DataTransformerID.merge,
    options: {},
  };

  beforeAll(() => {
    mockTransformationsRegistry([mergeTransformer]);
  });

  it('combine two series into one', done => {
    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Temp', type: FieldType.number, values: [1] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [2000] },
        { name: 'Temp', type: FieldType.number, values: [-1] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA, seriesB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [1000, 2000]),
          createField('Temp', FieldType.number, [1, -1]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine two series with multiple values into one', done => {
    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA, seriesB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [100, 150, 200, 100, 125, 126]),
          createField('Temp', FieldType.number, [1, 4, 5, -1, 2, 3]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine three series into one', done => {
    const seriesA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Temp', type: FieldType.number, values: [1] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [2000] },
        { name: 'Temp', type: FieldType.number, values: [-1] },
      ],
    });

    const seriesC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: [500] },
        { name: 'Temp', type: FieldType.number, values: [2] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [seriesA, seriesB, seriesC]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [1000, 2000, 500]),
          createField('Temp', FieldType.number, [1, -1, 2]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine one serie and two tables into one table', done => {
    const tableA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Temp', type: FieldType.number, values: [1] },
        { name: 'Humidity', type: FieldType.number, values: [10] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Temp', type: FieldType.number, values: [-1] },
      ],
    });

    const tableB = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: [500] },
        { name: 'Temp', type: FieldType.number, values: [2] },
        { name: 'Humidity', type: FieldType.number, values: [5] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [tableA, seriesB, tableB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [1000, 1000, 500]),
          createField('Temp', FieldType.number, [1, -1, 2]),
          createField('Humidity', FieldType.number, [10, null, 5]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine one serie and two tables with ISO dates into one table', done => {
    const tableA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: ['2019-10-01T11:10:23Z'] },
        { name: 'Temp', type: FieldType.number, values: [1] },
        { name: 'Humidity', type: FieldType.number, values: [10] },
      ],
    });

    const seriesB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: ['2019-09-01T11:10:23Z'] },
        { name: 'Temp', type: FieldType.number, values: [-1] },
      ],
    });

    const tableC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: ['2019-11-01T11:10:23Z'] },
        { name: 'Temp', type: FieldType.number, values: [2] },
        { name: 'Humidity', type: FieldType.number, values: [5] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [tableA, seriesB, tableC]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, ['2019-10-01T11:10:23Z', '2019-09-01T11:10:23Z', '2019-11-01T11:10:23Z']),
          createField('Temp', FieldType.number, [1, -1, 2]),
          createField('Humidity', FieldType.number, [10, null, 5]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine two tables, where first is partial overlapping, into one', done => {
    const tableA = toDataFrame({
      name: 'A',
      fields: [
        {
          name: 'Country',
          type: FieldType.string,
          values: ['United States', 'United States', 'Mexico', 'Germany', 'Canada', 'Canada'],
        },
        {
          name: 'AgeGroup',
          type: FieldType.string,
          values: ['50 or over', '35 - 49', '0 - 17', '35 - 49', '35 - 49', '25 - 34'],
        },
        { name: 'Sum', type: FieldType.number, values: [998, 1193, 1675, 146, 166, 219] },
      ],
    });

    const tableB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'AgeGroup', type: FieldType.string, values: ['0 - 17', '18 - 24', '25 - 34', '35 - 49', '50 or over'] },
        { name: 'Count', type: FieldType.number, values: [1, 3, 2, 4, 2] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [tableA, tableB]),
      expect: result => {
        const expected: Field[] = [
          createField('Country', FieldType.string, [
            'United States',
            'United States',
            'Mexico',
            'Germany',
            'Canada',
            'Canada',
            null,
          ]),
          createField('AgeGroup', FieldType.string, [
            '50 or over',
            '35 - 49',
            '0 - 17',
            '35 - 49',
            '35 - 49',
            '25 - 34',
            '18 - 24',
          ]),
          createField('Sum', FieldType.number, [998, 1193, 1675, 146, 166, 219, null]),
          createField('Count', FieldType.number, [2, 4, 1, 4, 4, 2, 3]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine two tables, where second is partial overlapping, into one', done => {
    /**
     * This behavior feels wrong. I would expect the same behavior regardless of the order
     * of the frames. But when testing the old table panel it had this behavior so I am
     * sticking with it.
     */
    const tableA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'AgeGroup', type: FieldType.string, values: ['0 - 17', '18 - 24', '25 - 34', '35 - 49', '50 or over'] },
        { name: 'Count', type: FieldType.number, values: [1, 3, 2, 4, 2] },
      ],
    });

    const tableB = toDataFrame({
      name: 'B',
      fields: [
        {
          name: 'Country',
          type: FieldType.string,
          values: ['United States', 'United States', 'Mexico', 'Germany', 'Canada', 'Canada'],
        },
        {
          name: 'AgeGroup',
          type: FieldType.string,
          values: ['50 or over', '35 - 49', '0 - 17', '35 - 49', '35 - 49', '25 - 34'],
        },
        { name: 'Sum', type: FieldType.number, values: [998, 1193, 1675, 146, 166, 219] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [tableA, tableB]),
      expect: result => {
        const expected: Field[] = [
          createField('AgeGroup', FieldType.string, [
            '0 - 17',
            '18 - 24',
            '25 - 34',
            '35 - 49',
            '50 or over',
            '35 - 49',
            '35 - 49',
          ]),
          createField('Count', FieldType.number, [1, 3, 2, 4, 2, null, null]),
          createField('Country', FieldType.string, [
            'Mexico',
            null,
            'Canada',
            'United States',
            'United States',
            'Germany',
            'Canada',
          ]),
          createField('Sum', FieldType.number, [1675, null, 219, 1193, 998, 146, 166]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine three tables with multiple values into one', done => {
    const tableA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
        { name: 'Humidity', type: FieldType.number, values: [10, 14, 55] },
      ],
    });

    const tableB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
        { name: 'Enabled', type: FieldType.boolean, values: [true, false, true] },
      ],
    });

    const tableC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 124, 149] },
        { name: 'Humidity', type: FieldType.number, values: [22, 25, 30] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [tableA, tableB, tableC]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [100, 150, 200, 100, 125, 126, 100, 124, 149]),
          createField('Temp', FieldType.number, [1, 4, 5, -1, 2, 3, 1, 4, 5]),
          createField('Humidity', FieldType.number, [10, 14, 55, null, null, null, 22, 25, 30]),
          createField('Enabled', FieldType.boolean, [null, null, null, true, false, true, null, null, null]),
        ];

        expect(unwrap(result[0].fields)).toEqual(expected);
      },
      done,
    });
  });

  it('combine two time series, where first serie fields has displayName, into one', done => {
    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200], config: { displayName: 'Random time' } },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5], config: { displayName: 'Temp' } },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [100, 150, 200, 100, 125, 126]),
          createField('Temp', FieldType.number, [1, 4, 5, -1, 2, 3]),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[1].config).toEqual({});
        expect(fields).toEqual(expected);
      },
      done,
    });
  });

  it('combine two time series, where first serie fields has display processor, into one', done => {
    const displayProcessor: DisplayProcessor = jest.fn();

    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200], display: displayProcessor },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [100, 150, 200, 100, 125, 126], {}, displayProcessor),
          createField('Temp', FieldType.number, [1, 4, 5, -1, 2, 3]),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[0].display).toBe(displayProcessor);
        expect(fields).toEqual(expected);
      },
      done,
    });
  });

  it('combine two time series, where first serie fields has units, into one', done => {
    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5], config: { units: 'celsius' } },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [100, 150, 200, 100, 125, 126]),
          createField('Temp', FieldType.number, [1, 4, 5, -1, 2, 3], { units: 'celsius' }),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[1].config).toEqual({ units: 'celsius' });
        expect(fields).toEqual(expected);
      },
      done,
    });
  });

  it('combine two time series, where second serie fields has units, into one', done => {
    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 125, 126] },
        { name: 'Temp', type: FieldType.number, values: [-1, 2, 3], config: { units: 'celsius' } },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [100, 150, 200, 100, 125, 126]),
          createField('Temp', FieldType.number, [1, 4, 5, -1, 2, 3]),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[1].config).toEqual({});
        expect(fields).toEqual(expected);
      },
      done,
    });
  });

  it('combine one regular serie with an empty serie should return the regular serie', done => {
    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [100, 150, 200]),
          createField('Temp', FieldType.number, [1, 4, 5]),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[1].config).toEqual({});
        expect(fields).toEqual(expected);
      },
      done,
    });
  });

  it('combine two regular series with an empty serie should return the combination of the regular series', done => {
    const serieA = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Temp', type: FieldType.number, values: [1, 4, 5] },
      ],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [],
    });

    const serieC = toDataFrame({
      name: 'C',
      fields: [
        { name: 'Time', type: FieldType.time, values: [100, 150, 200] },
        { name: 'Humidity', type: FieldType.number, values: [6, 7, 8] },
      ],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB, serieC]),
      expect: result => {
        const expected: Field[] = [
          createField('Time', FieldType.time, [100, 150, 200]),
          createField('Temp', FieldType.number, [1, 4, 5]),
          createField('Humidity', FieldType.number, [6, 7, 8]),
        ];

        const fields = unwrap(result[0].fields);

        expect(fields[1].config).toEqual({});
        expect(fields).toEqual(expected);
      },
      done,
    });
  });

  it('combine multiple empty series should return one empty serie', done => {
    const serieA = toDataFrame({
      name: 'A',
      fields: [],
    });

    const serieB = toDataFrame({
      name: 'B',
      fields: [],
    });

    const serieC = toDataFrame({
      name: 'C',
      fields: [],
    });

    observableTester().subscribeAndExpectOnNext({
      observable: transformDataFrame([cfg], [serieA, serieB, serieC]),
      expect: result => {
        const expected: Field[] = [];
        const fields = unwrap(result[0].fields);

        expect(fields).toEqual(expected);
        expect(result.length).toEqual(1);
      },
      done,
    });
  });
});

const createField = (name: string, type: FieldType, values: any[], config = {}, display?: DisplayProcessor): Field => {
  return { name, type, values: new ArrayVector(values), config, labels: undefined, display };
};

const unwrap = (fields: Field[]): Field[] => {
  return fields.map(field =>
    createField(
      field.name,
      field.type,
      field.values.toArray().map((value: any) => value),
      field.config,
      field.display
    )
  );
};
