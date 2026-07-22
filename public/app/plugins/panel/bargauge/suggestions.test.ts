import {
  createDataFrame,
  type Field,
  FieldType,
  getPanelDataSummary,
  type VisualizationSuggestion,
} from '@grafana/data';
import { BarGaugeDisplayMode } from '@grafana/ui';

import { type Options } from './panelcfg.gen';
import { BARGAUGE_CARD_OPTIONS, barGaugeSugggestionsSupplier } from './suggestions';

describe('barGaugeSugggestionsSupplier', () => {
  it('does not suggest bar gauge if no data is present', () => {
    expect(barGaugeSugggestionsSupplier(getPanelDataSummary([]))).toBeFalsy();
    expect(barGaugeSugggestionsSupplier(getPanelDataSummary(undefined))).toBeFalsy();
    expect(
      barGaugeSugggestionsSupplier(
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

  it('does not suggest bar gauge if there are no numeric fields', () => {
    const df = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'status', type: FieldType.string },
      ],
    });
    expect(barGaugeSugggestionsSupplier(getPanelDataSummary([df]))).toBeFalsy();
  });

  it('does not suggest bar gauge if there are too many numeric fields', () => {
    const fields: Field[] = [];
    for (let i = 0; i < 31; i++) {
      fields.push({ name: `numeric-${i}`, type: FieldType.number, values: [0, 100, 200, 300, 400, 500], config: {} });
    }
    expect(barGaugeSugggestionsSupplier(getPanelDataSummary([createDataFrame({ fields })]))).toBeFalsy();
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

    const primary = (suggestions as Array<{ name: string; options?: Options; fieldConfig?: unknown }>)[0];
    expect(primary.options?.displayMode).toBe(BarGaugeDisplayMode.Basic);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((primary.fieldConfig as any)?.defaults?.color?.mode).toBe('continuous-GrYlRd');
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
      const suggestions = barGaugeSugggestionsSupplier(getPanelDataSummary(dataframes));
      const expected = aggregated ? { values: false, calcs: ['lastNotNull'] } : { values: true, calcs: [] };

      expect(Array.isArray(suggestions)).toBe(true);
      if (Array.isArray(suggestions)) {
        for (const suggestion of suggestions) {
          expect(suggestion.options?.reduceOptions).toEqual(expect.objectContaining(expected));
        }
      }
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

  it('does not throw when options are missing', () => {
    const suggestion: VisualizationSuggestion<Options> = { name: 'preview' };

    expect(() => previewModifier(suggestion)).not.toThrow();
  });

  it('sets maxSeries to the preview limit', () => {
    expect(BARGAUGE_CARD_OPTIONS!.maxSeries).toBe(6);
  });
});
