import {
  createDataFrame,
  type DataFrame,
  type Field,
  FieldType,
  getPanelDataSummary,
  type VisualizationSuggestion,
} from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';

import { type Options } from './panelcfg.gen';
import { BARGAUGE_CARD_OPTIONS, barGaugeSugggestionsSupplier } from './suggestions';

/** BAR_LIMIT in ./suggestions — more numeric fields than this and no bar gauge is suggested. */
const BAR_LIMIT = 30;

function numericFields(count: number): Field[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `numeric-${i}`,
    type: FieldType.number,
    values: [0, 100, 200, 300, 400, 500],
    config: {},
  }));
}

describe('barGaugeSugggestionsSupplier', () => {
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
    expect(barGaugeSugggestionsSupplier(getPanelDataSummary(frames))).toBeUndefined();
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

    expect(barGaugeSugggestionsSupplier(dataSummary)).toBeUndefined();
  });

  it('still suggests bar gauges at the limit of 30 numeric fields', () => {
    const dataSummary = getPanelDataSummary([createDataFrame({ fields: numericFields(BAR_LIMIT) })]);

    expect(barGaugeSugggestionsSupplier(dataSummary)).toEqual([
      expect.objectContaining({ name: 'Bar gauge' }),
      expect.objectContaining({ name: 'Bar gauge - LCD' }),
    ]);
  });

  it('returns undefined one numeric field past the limit of 30', () => {
    const dataSummary = getPanelDataSummary([createDataFrame({ fields: numericFields(BAR_LIMIT + 1) })]);

    expect(barGaugeSugggestionsSupplier(dataSummary)).toBeUndefined();
  });

  it('suggests bar gauge and LCD variant for a single numeric field', () => {
    const suggestions = barGaugeSugggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [0, 100, 200, 300, 400, 500] },
            { name: 'value', type: FieldType.number, values: [0, 100, 200, 300, 400, 500] },
          ],
        }),
      ])
    );

    expect(suggestions).toEqual([
      expect.objectContaining({ name: 'Bar gauge' }),
      expect.objectContaining({
        name: 'Bar gauge - LCD',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Lcd }),
      }),
    ]);
  });

  it('applies defaults: basic display mode and continuous color for the primary suggestion', () => {
    const suggestions = barGaugeSugggestionsSupplier(
      getPanelDataSummary([
        createDataFrame({
          fields: [{ name: 'value', type: FieldType.number, values: [10, 20, 30, 40, 50] }],
        }),
      ])
    );

    expect(suggestions).toEqual([
      expect.objectContaining({
        name: 'Bar gauge',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Basic }),
        fieldConfig: expect.objectContaining({
          defaults: expect.objectContaining({ color: expect.objectContaining({ mode: 'continuous-GrYlRd' }) }),
        }),
      }),
      expect.objectContaining({ name: 'Bar gauge - LCD' }),
    ]);
  });

  describe('aggregation', () => {
    it.each([
      {
        description: 'tabular data with few rows and a string field uses raw values',
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
        description: 'only numeric data aggregates',
        aggregated: true,
        dataframes: [
          createDataFrame({
            fields: [{ name: 'value', type: FieldType.number, values: [10, 20, 30, 40, 50] }],
          }),
        ],
      },
      {
        description: 'multiple frames with tabular data aggregates',
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

      expect(barGaugeSugggestionsSupplier(getPanelDataSummary(dataframes))).toEqual([
        expect.objectContaining({
          name: 'Bar gauge',
          options: expect.objectContaining({ reduceOptions: expect.objectContaining(reduceOptions) }),
        }),
        expect.objectContaining({
          name: 'Bar gauge - LCD',
          options: expect.objectContaining({ reduceOptions: expect.objectContaining(reduceOptions) }),
        }),
      ]);
    });
  });
});

describe('BARGAUGE_CARD_OPTIONS.previewModifier', () => {
  const previewModifier = BARGAUGE_CARD_OPTIONS!.previewModifier!;

  it('limits the number of previewed bars when reduceOptions.values is enabled', () => {
    const suggestion: VisualizationSuggestion<Options> = {
      name: 'preview',
      options: { reduceOptions: { values: true, calcs: [] } },
    };

    previewModifier(suggestion);

    expect(suggestion.options?.reduceOptions?.limit).toBe(6);
  });

  it('does not set a limit when reduceOptions.values is not enabled', () => {
    const suggestion: VisualizationSuggestion<Options> = {
      name: 'preview',
      options: { reduceOptions: { values: false, calcs: ['lastNotNull'] } },
    };

    previewModifier(suggestion);

    expect(suggestion.options?.reduceOptions?.limit).toBeUndefined();
  });

  it('does not modify a suggestion without options', () => {
    const suggestion: VisualizationSuggestion<Options> = { name: 'preview' };

    previewModifier(suggestion);

    expect(suggestion).toEqual({ name: 'preview' });
  });
});
