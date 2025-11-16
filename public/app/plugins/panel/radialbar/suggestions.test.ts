import { createDataFrame, Field, FieldType, getPanelDataSummary } from '@grafana/data';

import { radialBarSuggestionsHandler } from './suggestions';

describe('RadialBarPanel Suggestions', () => {
  it('does not suggest gauge if no data is present', () => {
    expect(radialBarSuggestionsHandler(getPanelDataSummary([]))).toBeFalsy();
    expect(radialBarSuggestionsHandler(getPanelDataSummary(undefined))).toBeFalsy();
    expect(
      radialBarSuggestionsHandler(
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

  it('does not suggest gauge if there are no numeric fields', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'status', type: FieldType.string },
      ],
    });
    expect(radialBarSuggestionsHandler(getPanelDataSummary([df]))).toBeFalsy();
  });

  it('does not suggest gauge if there are too many numeric fields', () => {
    const fields: Field[] = [];
    for (let i = 0; i < 20; i++) {
      fields.push({ name: `numeric-${i}`, type: FieldType.number, values: [0, 100, 200, 300, 400, 500], config: {} });
    }
    expect(radialBarSuggestionsHandler(getPanelDataSummary([createDataFrame({ fields })]))).toBeFalsy();
  });

  it('suggests gauge for a single numeric field', () => {
    expect(
      radialBarSuggestionsHandler(
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
      radialBarSuggestionsHandler(
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
      const suggestions = radialBarSuggestionsHandler(getPanelDataSummary(dataframes));
      const expected = aggregated ? { values: false, calcs: ['lastNotNull'] } : { values: true, calcs: [] };
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
