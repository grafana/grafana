import { createDataFrame, type DataFrame, type Field, FieldType, getPanelDataSummary } from '@grafana/data';

import { gaugeSuggestionsSupplier } from './suggestions';

/** MAX_GAUGES in ./suggestions — more numeric fields than this and no gauge is suggested. */
const MAX_GAUGES = 10;

function numericFields(count: number): Field[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `numeric-${i}`,
    type: FieldType.number,
    values: [0, 100, 200, 300, 400, 500],
    config: {},
  }));
}

describe('GaugePanel Suggestions', () => {
  it.each<{ description: string; frames?: DataFrame[] }>([
    { description: 'an empty frame list', frames: [] },
    { description: 'undefined panel data', frames: undefined },
    {
      description: 'a frame whose fields carry no rows',
      frames: [
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [] },
            { name: 'value', type: FieldType.number, values: [] },
          ],
        }),
      ],
    },
  ])('returns undefined for $description', ({ frames }) => {
    expect(gaugeSuggestionsSupplier(getPanelDataSummary(frames))).toBeUndefined();
  });

  it('returns undefined when rows exist but no field is numeric', () => {
    const dataSummary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [0, 100, 200] },
          { name: 'status', type: FieldType.string, values: ['ok', 'warn', 'error'] },
        ],
      }),
    ]);
    // The fields must carry rows, otherwise the supplier returns on `!hasData` and this case
    // would only repeat the no-data one above instead of reaching the numeric-field check.
    expect(dataSummary.hasData).toBe(true);

    expect(gaugeSuggestionsSupplier(dataSummary)).toBeUndefined();
  });

  it('still suggests gauges at the limit of 10 numeric fields', () => {
    const dataSummary = getPanelDataSummary([createDataFrame({ fields: numericFields(MAX_GAUGES) })]);

    expect(gaugeSuggestionsSupplier(dataSummary)).toEqual([
      expect.objectContaining({ name: 'Gauge' }),
      expect.objectContaining({ name: 'Circular gauge' }),
    ]);
  });

  it('returns undefined one numeric field past the limit of 10', () => {
    const dataSummary = getPanelDataSummary([createDataFrame({ fields: numericFields(MAX_GAUGES + 1) })]);

    expect(gaugeSuggestionsSupplier(dataSummary)).toBeUndefined();
  });

  it('suggests gauge for a single numeric field', () => {
    expect(
      gaugeSuggestionsSupplier(
        getPanelDataSummary([
          createDataFrame({
            fields: [
              { name: 'time', type: FieldType.time, values: [0, 100, 200, 300, 400, 500] },
              { name: 'value', type: FieldType.number, values: [0, 100, 200, 300, 400, 500] },
            ],
          }),
        ])
      )
    ).toEqual([
      expect.objectContaining({ name: 'Gauge' }),
      expect.objectContaining({ name: 'Circular gauge', options: expect.objectContaining({ shape: 'circle' }) }),
    ]);
  });

  it('suggests gauge for a few numeric fields, with other fields mixed in', () => {
    expect(
      gaugeSuggestionsSupplier(
        getPanelDataSummary([
          createDataFrame({
            fields: [
              { name: 'time', type: FieldType.time, values: [0, 100, 200, 300, 400, 500] },
              { name: 'value', type: FieldType.number, values: [0, 100, 200, 300, 400, 500] },
              { name: 'value2', type: FieldType.number, values: [0, 100, 200, 300, 400, 500] },
              { name: 'value3', type: FieldType.number, values: [0, 100, 200, 300, 400, 500] },
              { name: 'string', type: FieldType.string, values: ['foo', 'bar', null, 'bax', 'bop', 'bim'] },
              { name: 'boolean', type: FieldType.boolean, values: [true, false, true, false, true, false] },
            ],
          }),
        ])
      )
    ).toEqual([
      expect.objectContaining({ name: 'Gauge' }),
      expect.objectContaining({ name: 'Circular gauge', options: expect.objectContaining({ shape: 'circle' }) }),
    ]);
  });

  describe('aggregation', () => {
    it.each([
      {
        description: 'tabular data with few rows',
        aggregated: false,
        dataframes: [
          createDataFrame({
            fields: [
              { name: 'name', type: FieldType.string, values: ['A', 'B', 'C'] },
              { name: 'value', type: FieldType.number, values: [100, 200, 300] },
            ],
          }),
        ],
      },
      {
        description: 'tabular data with too many datapoints',
        aggregated: true,
        dataframes: [
          createDataFrame({
            fields: [
              {
                name: 'string',
                type: FieldType.string,
                values: ['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A'],
              },
              { name: 'value', type: FieldType.number, values: [10, 20, 30, 40, 50, 60, 50, 40, 30, 20, 10] },
            ],
          }),
        ],
      },
      {
        description: 'only numeric data',
        aggregated: true,
        dataframes: [
          createDataFrame({
            fields: [{ name: 'value', type: FieldType.number, values: [10, 20, 30, 40, 50] }],
          }),
        ],
      },
      {
        description: 'multiple frames with tabular data',
        aggregated: true,
        dataframes: [
          createDataFrame({
            fields: [
              { name: 'name', type: FieldType.string, values: ['A', 'B', 'C'] },
              { name: 'value', type: FieldType.number, values: [100, 200, 300] },
            ],
          }),
          createDataFrame({
            fields: [
              { name: 'name', type: FieldType.string, values: ['D', 'E', 'F'] },
              { name: 'value', type: FieldType.number, values: [600, 700, 800] },
            ],
          }),
        ],
      },
    ])('$description suggests aggregated=$aggregated', ({ dataframes, aggregated }) => {
      const reduceOptions = aggregated ? { values: false, calcs: ['lastNotNull'] } : { values: true, calcs: [] };

      expect(gaugeSuggestionsSupplier(getPanelDataSummary(dataframes))).toEqual([
        expect.objectContaining({ name: 'Gauge', options: expect.objectContaining({ reduceOptions }) }),
        expect.objectContaining({ name: 'Circular gauge', options: expect.objectContaining({ reduceOptions }) }),
      ]);
    });
  });
});
