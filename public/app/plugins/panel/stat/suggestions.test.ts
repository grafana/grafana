import { createDataFrame, type DataFrame, FieldType, getPanelDataSummary } from '@grafana/data';

import { statSuggestionsSupplier } from './suggestions';

/** MAX_STATS in ./suggestions — the shared ceiling on frame count and row count. */
const MAX_STATS = 50;

function timeSeriesFrames(count: number): DataFrame[] {
  return Array.from({ length: count }, () =>
    createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 100] },
        { name: 'value', type: FieldType.number, values: [10, 20] },
      ],
    })
  );
}

function singleStringFrame(rowCount: number): DataFrame {
  return createDataFrame({
    fields: [
      { name: 'label', type: FieldType.string, values: Array.from({ length: rowCount }, (_, i) => `item-${i}`) },
    ],
  });
}

describe('State panel suggestions', () => {
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
    expect(statSuggestionsSupplier(getPanelDataSummary(frames))).toBeUndefined();
  });

  it.each<{ description: string; dataframes: DataFrame[] }>([
    {
      description: 'time and string fields but nothing numeric',
      dataframes: [
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [0, 100, 200] },
            { name: 'status', type: FieldType.string, values: ['ok', 'warn', 'error'] },
          ],
        }),
      ],
    },
    {
      description: 'a single numeric field with no time or string field alongside it',
      dataframes: [createDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [10, 20, 30] }] })],
    },
    {
      description: 'tabular data spread across more than one frame',
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
  ])('produces no suggestions for $description', ({ dataframes }) => {
    const dataSummary = getPanelDataSummary(dataframes);
    // The fields must carry rows, otherwise the supplier returns undefined on `!hasData` and
    // these cases would only repeat the no-data ones above.
    expect(dataSummary.hasData).toBe(true);

    expect(statSuggestionsSupplier(dataSummary)).toEqual([]);
  });

  it('suggests aggregated stats at the limit of 50 time series frames', () => {
    const dataSummary = getPanelDataSummary(timeSeriesFrames(MAX_STATS));

    expect(statSuggestionsSupplier(dataSummary)).toEqual([
      expect.objectContaining({ name: 'Stat' }),
      expect.objectContaining({ name: 'Stat - color background' }),
    ]);
  });

  it('returns undefined one frame past the limit of 50 time series frames', () => {
    const dataSummary = getPanelDataSummary(timeSeriesFrames(MAX_STATS + 1));

    expect(statSuggestionsSupplier(dataSummary)).toBeUndefined();
  });

  it('suggests a single-string stat at the limit of 50 rows', () => {
    const dataSummary = getPanelDataSummary([singleStringFrame(MAX_STATS)]);

    expect(statSuggestionsSupplier(dataSummary)).toEqual([expect.objectContaining({ name: 'Stat - single string' })]);
  });

  it('returns undefined one row past the limit of 50 rows for a single string field', () => {
    const dataSummary = getPanelDataSummary([singleStringFrame(MAX_STATS + 1)]);

    expect(statSuggestionsSupplier(dataSummary)).toBeUndefined();
  });

  it('suggests stat for a single numeric field', () => {
    expect(
      statSuggestionsSupplier(
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
      expect.objectContaining({ name: 'Stat' }),
      expect.objectContaining({ name: 'Stat - color background' }),
    ]);
  });

  it('suggests stat for a few numeric fields, with other fields mixed in', () => {
    expect(
      statSuggestionsSupplier(
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
      expect.objectContaining({ name: 'Stat' }),
      expect.objectContaining({ name: 'Stat - color background' }),
    ]);
  });

  describe('aggregation', () => {
    it.each([
      {
        description: 'tabular data with few rows',
        aggregated: false,
        expectedNames: ['Stat - discrete values', 'Stat - discrete values - color background'],
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
        description: 'tabular data with high row count',
        aggregated: true,
        expectedNames: ['Stat', 'Stat - color background'],
        dataframes: [
          createDataFrame({
            fields: [
              { name: 'name', type: FieldType.string, values: Array.from({ length: 51 }, (_, i) => `item_${i}`) },
              { name: 'value', type: FieldType.number, values: Array.from({ length: 51 }, (_, i) => i * 10) },
            ],
          }),
        ],
      },
    ])(
      '$description suggests $expectedNames with aggregated=$aggregated',
      ({ dataframes, aggregated, expectedNames }) => {
        const reduceOptions = aggregated
          ? { values: false, calcs: ['lastNotNull'] }
          : { values: true, fields: '/.*/', calcs: [] };

        expect(statSuggestionsSupplier(getPanelDataSummary(dataframes))).toEqual(
          expectedNames.map((name) =>
            expect.objectContaining({ name, options: expect.objectContaining({ reduceOptions }) })
          )
        );
      }
    );
  });
});
