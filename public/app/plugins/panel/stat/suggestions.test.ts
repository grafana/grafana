import { createDataFrame, Field, FieldType, getPanelDataSummary } from '@grafana/data';

import { statSuggestionsSupplier } from './suggestions';

describe('State panel suggestions', () => {
  it('does not suggest stat if no data is present', () => {
    expect(statSuggestionsSupplier(getPanelDataSummary([]))).toBeFalsy();
    expect(statSuggestionsSupplier(getPanelDataSummary(undefined))).toBeFalsy();
    expect(
      statSuggestionsSupplier(
        getPanelDataSummary([
          createDataFrame({
            fields: [
              { name: 'time', type: FieldType.time, values: [] },
              { name: 'value', type: FieldType.number, values: [] },
            ],
          }),
        ])
      )
    ).toBeFalsy();
  });

  it('does not suggest stat if there are no numeric fields', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'status', type: FieldType.string },
      ],
    });
    expect(statSuggestionsSupplier(getPanelDataSummary([df]))).toBeFalsy();
  });

  it('does not suggest stat if there are too many numeric fields', () => {
    const fields: Field[] = [];
    for (let i = 0; i < 100; i++) {
      fields.push({ name: `numeric-${i}`, type: FieldType.number, values: [0, 100, 200, 300, 400, 500], config: {} });
    }
    expect(statSuggestionsSupplier(getPanelDataSummary([createDataFrame({ fields })]))).toHaveLength(0);
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
      const suggestions = statSuggestionsSupplier(getPanelDataSummary(dataframes));
      const expected = aggregated
        ? { values: false, calcs: ['lastNotNull'] }
        : { values: true, fields: '/.*/', calcs: [] };
      if (Array.isArray(suggestions)) {
        for (const suggestion of suggestions) {
          expect(suggestion.options?.reduceOptions).toEqual(expected);
        }
      } else {
        // this will fail if we're in this else case.
        expect(suggestions).toBeInstanceOf(Array);
      }
    });
  });
});
