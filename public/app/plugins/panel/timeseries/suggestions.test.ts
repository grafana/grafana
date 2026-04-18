import {
  createDataFrame,
  DataFrameType,
  FieldType,
  getPanelDataSummary,
  VisualizationSuggestionScore,
} from '@grafana/data';
import { GraphDrawStyle, LegendDisplayMode, StackingMode } from '@grafana/schema';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import {
  createDashboardModelFixture,
  createPanelSaveModel,
} from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';

import { type Options } from './panelcfg.gen';
import { getPrepareTimeseriesSuggestion, timeseriesSuggestionsSupplier } from './suggestions';

function makeSingleSeries(times: number[], values: number[]) {
  return getPanelDataSummary([
    createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: times },
        { name: 'value', type: FieldType.number, values: values },
      ],
    }),
  ]);
}

function makeMultipleSeries(times: number[], values1: number[], values2: number[]) {
  return getPanelDataSummary([
    createDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: times },
        { name: 'value1', type: FieldType.number, values: values1 },
        { name: 'value2', type: FieldType.number, values: values2 },
      ],
    }),
  ]);
}

describe('timeseries panel suggestions', () => {
  describe('early return conditions', () => {
    it('should not suggest timeseries if this is an instant query', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1625247600000] },
            { name: 'value', type: FieldType.number, values: [10] },
          ],
        }),
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1625247600000] },
            { name: 'value2', type: FieldType.number, values: [20] },
          ],
        }),
      ]);

      expect(dataSummary.isInstant).toBe(true);
      expect(timeseriesSuggestionsSupplier(dataSummary)).toBeUndefined();
    });

    it('should not suggest timeseries when there is no time field', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [{ name: 'value', type: FieldType.number, values: [10, 20, 30] }],
        }),
      ]);

      expect(timeseriesSuggestionsSupplier(dataSummary)).toBeUndefined();
    });

    it('should not suggest timeseries when there is no number field', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'label', type: FieldType.string, values: ['a', 'b', 'c'] },
          ],
        }),
      ]);

      expect(timeseriesSuggestionsSupplier(dataSummary)).toBeUndefined();
    });

    it('should not suggest timeseries when rowCountTotal is less than 2', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1625247600000] },
            { name: 'value', type: FieldType.number, values: [10] },
          ],
        }),
      ]);

      expect(dataSummary.rowCountTotal).toBe(1);
      expect(timeseriesSuggestionsSupplier(dataSummary)).toBeUndefined();
    });
  });

  describe('single series suggestions', () => {
    it('should suggest line chart for single series', () => {
      const result = timeseriesSuggestionsSupplier(makeSingleSeries([0, 1000, 2000], [10, 20, 30]));

      expect(result).toBeDefined();
      expect(result!.some((s) => s.name === 'Line chart')).toBe(true);
    });

    it('should suggest area chart for single series', () => {
      const result = timeseriesSuggestionsSupplier(makeSingleSeries([0, 1000, 2000], [10, 20, 30]));

      expect(result).toBeDefined();
      expect(result!.some((s) => s.name === 'Area chart')).toBe(true);
    });

    it('should suggest bar chart for single series with fewer than 100 rows', () => {
      const result = timeseriesSuggestionsSupplier(makeSingleSeries([0, 1000, 2000], [10, 20, 30]));

      expect(result).toBeDefined();
      expect(result!.some((s) => s.name === 'Bar chart')).toBe(true);
    });

    it('should not suggest bar chart for single series with 100 or more rows', () => {
      const times: number[] = [];
      const values: number[] = [];
      for (let i = 0; i < 100; i++) {
        times.push(i * 1000);
        values.push(i);
      }

      const result = timeseriesSuggestionsSupplier(makeSingleSeries(times, values));

      expect(result).toBeDefined();
      expect(result!.some((s) => s.name === 'Bar chart')).toBe(false);
    });

    it('should set fillOpacity=25 for area chart suggestion', () => {
      const result = timeseriesSuggestionsSupplier(makeSingleSeries([0, 1000, 2000], [10, 20, 30]));
      const areaChart = result!.find((s) => s.name === 'Area chart');

      expect(areaChart?.fieldConfig?.defaults?.custom?.fillOpacity).toBe(25);
    });

    it('should set bar chart with drawStyle=Bars and fillOpacity=100', () => {
      const result = timeseriesSuggestionsSupplier(makeSingleSeries([0, 1000, 2000], [10, 20, 30]));
      const barChart = result!.find((s) => s.name === 'Bar chart');

      expect(barChart?.fieldConfig?.defaults?.custom?.drawStyle).toBe(GraphDrawStyle.Bars);
      expect(barChart?.fieldConfig?.defaults?.custom?.fillOpacity).toBe(100);
    });
  });

  describe('multiple series suggestions', () => {
    it('should suggest line chart for multiple series', () => {
      const result = timeseriesSuggestionsSupplier(makeMultipleSeries([0, 1000, 2000], [10, 20, 30], [5, 15, 25]));

      expect(result).toBeDefined();
      expect(result!.some((s) => s.name === 'Line chart')).toBe(true);
    });

    it('should suggest stacked area chart for multiple series', () => {
      const result = timeseriesSuggestionsSupplier(makeMultipleSeries([0, 1000, 2000], [10, 20, 30], [5, 15, 25]));

      expect(result).toBeDefined();
      const stackedArea = result!.find((s) => s.name === 'Area chart - stacked');
      expect(stackedArea).toBeDefined();
      expect(stackedArea?.fieldConfig?.defaults?.custom?.stacking?.mode).toBe(StackingMode.Normal);
    });

    it('should suggest percentage stacked area chart for multiple series', () => {
      const result = timeseriesSuggestionsSupplier(makeMultipleSeries([0, 1000, 2000], [10, 20, 30], [5, 15, 25]));

      expect(result).toBeDefined();
      const pctArea = result!.find((s) => s.name === 'Area chart - stacked by percentage');
      expect(pctArea).toBeDefined();
      expect(pctArea?.fieldConfig?.defaults?.custom?.stacking?.mode).toBe(StackingMode.Percent);
    });

    it('should suggest stacked bar chart when avg rows per series < 100', () => {
      // 2 number fields, 3 rows each → 6 total / 2 fields = 3 avg, which is < 100
      const result = timeseriesSuggestionsSupplier(makeMultipleSeries([0, 1000, 2000], [10, 20, 30], [5, 15, 25]));

      expect(result).toBeDefined();
      expect(result!.some((s) => s.name === 'Bar chart - stacked')).toBe(true);
      expect(result!.some((s) => s.name === 'Bar chart - stacked by percentage')).toBe(true);
    });

    it('should not suggest bar charts when avg rows per series >= 100', () => {
      // 2 number fields, 200 rows each → 400 total / 2 fields = 200 avg, which is >= 100
      const times: number[] = [];
      const values1: number[] = [];
      const values2: number[] = [];
      for (let i = 0; i < 200; i++) {
        times.push(i * 1000);
        values1.push(i);
        values2.push(i * 2);
      }

      const result = timeseriesSuggestionsSupplier(makeMultipleSeries(times, values1, values2));

      expect(result).toBeDefined();
      expect(result!.some((s) => s.name === 'Bar chart - stacked')).toBe(false);
      expect(result!.some((s) => s.name === 'Bar chart - stacked by percentage')).toBe(false);
    });

    it('should not suggest single-series area chart for multiple series', () => {
      const result = timeseriesSuggestionsSupplier(makeMultipleSeries([0, 1000, 2000], [10, 20, 30], [5, 15, 25]));

      expect(result).toBeDefined();
      // "Area chart" (non-stacked) is only for single series
      expect(result!.some((s) => s.name === 'Area chart')).toBe(false);
    });
  });

  describe('suggestion scoring', () => {
    it('should give Good score for TimeSeriesWide data', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          meta: { type: DataFrameType.TimeSeriesWide },
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ]);

      const result = timeseriesSuggestionsSupplier(dataSummary);
      expect(result).toBeDefined();
      expect(result!.every((s) => s.score === VisualizationSuggestionScore.Good)).toBe(true);
    });

    it('should give Good score for TimeSeriesLong data', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          meta: { type: DataFrameType.TimeSeriesLong },
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ]);

      const result = timeseriesSuggestionsSupplier(dataSummary);
      expect(result).toBeDefined();
      expect(result!.every((s) => s.score === VisualizationSuggestionScore.Good)).toBe(true);
    });

    it('should give Good score for TimeSeriesMulti data', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          meta: { type: DataFrameType.TimeSeriesMulti },
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ]);

      const result = timeseriesSuggestionsSupplier(dataSummary);
      expect(result).toBeDefined();
      expect(result!.every((s) => s.score === VisualizationSuggestionScore.Good)).toBe(true);
    });

    it('should give OK score for non-timeseries typed data', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ]);

      const result = timeseriesSuggestionsSupplier(dataSummary);
      expect(result).toBeDefined();
      expect(result!.every((s) => s.score === VisualizationSuggestionScore.OK)).toBe(true);
    });
  });

  describe('suggestion defaults', () => {
    it('should include fieldConfig defaults on all suggestions', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ]);

      const result = timeseriesSuggestionsSupplier(dataSummary);
      expect(result).toBeDefined();
      for (const suggestion of result!) {
        expect(suggestion.fieldConfig).toBeDefined();
        expect(suggestion.fieldConfig?.defaults?.custom).toBeDefined();
        expect(suggestion.fieldConfig?.overrides).toBeDefined();
      }
    });

    it('should include cardOptions with maxSeries on all suggestions', () => {
      const dataSummary = getPanelDataSummary([
        createDataFrame({
          fields: [
            { name: 'time', type: FieldType.time, values: [1, 2, 3] },
            { name: 'value', type: FieldType.number, values: [10, 20, 30] },
          ],
        }),
      ]);

      const result = timeseriesSuggestionsSupplier(dataSummary);
      expect(result).toBeDefined();
      for (const suggestion of result!) {
        expect(suggestion.cardOptions?.maxSeries).toBeDefined();
      }
    });
  });

  describe('previewModifier', () => {
    const summary = getPanelDataSummary([
      createDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [1, 2, 3] },
          { name: 'value', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ]);

    it('sets disableKeyboardEvents=true on the suggestion options', () => {
      const result = timeseriesSuggestionsSupplier(summary)!;
      const suggestion = { ...result[0], options: {} as Partial<Options> };
      result[0].cardOptions!.previewModifier!(suggestion);
      expect(suggestion.options!.disableKeyboardEvents).toBe(true);
    });

    it('sets legend to hidden mode', () => {
      const result = timeseriesSuggestionsSupplier(summary)!;
      const suggestion = { ...result[0], options: {} as Partial<Options> };
      result[0].cardOptions!.previewModifier!(suggestion);
      expect(suggestion.options!.legend?.displayMode).toBe(LegendDisplayMode.Hidden);
      expect(suggestion.options!.legend?.showLegend).toBe(false);
    });

    it('boosts lineWidth to at least 2 for line chart', () => {
      const result = timeseriesSuggestionsSupplier(summary)!;
      const lineChart = result.find((s) => s.name === 'Line chart')!;
      const suggestion = {
        ...lineChart,
        options: {} as Partial<Options>,
        fieldConfig: { defaults: { custom: { lineWidth: 1 } }, overrides: [] },
      };
      lineChart.cardOptions!.previewModifier!(suggestion);
      expect(suggestion.fieldConfig!.defaults!.custom!.lineWidth).toBe(2);
    });

    it('does not lower lineWidth if already above 2', () => {
      const result = timeseriesSuggestionsSupplier(summary)!;
      const lineChart = result.find((s) => s.name === 'Line chart')!;
      const suggestion = {
        ...lineChart,
        options: {} as Partial<Options>,
        fieldConfig: { defaults: { custom: { lineWidth: 5 } }, overrides: [] },
      };
      lineChart.cardOptions!.previewModifier!(suggestion);
      expect(suggestion.fieldConfig!.defaults!.custom!.lineWidth).toBe(5);
    });

    it('does not change lineWidth for bar chart suggestions', () => {
      const result = timeseriesSuggestionsSupplier(summary)!;
      const barChart = result.find((s) => s.name === 'Bar chart')!;
      const suggestion = {
        ...barChart,
        options: {} as Partial<Options>,
        fieldConfig: { defaults: { custom: { drawStyle: GraphDrawStyle.Bars, lineWidth: 1 } }, overrides: [] },
      };
      barChart.cardOptions!.previewModifier!(suggestion);
      // lineWidth should be unchanged for bar charts
      expect(suggestion.fieldConfig!.defaults!.custom!.lineWidth).toBe(1);
    });
  });

  describe('getPrepareTimeseriesSuggestion', () => {
    beforeEach(() => {
      const dashboard = createDashboardModelFixture({
        panels: [createPanelSaveModel({ id: 1, type: 'timeseries' })],
      });
      getDashboardSrv().setCurrent(dashboard);
    });

    it('returns undefined when there is no current dashboard', () => {
      getDashboardSrv().setCurrent(null as never);
      expect(getPrepareTimeseriesSuggestion(1)).toBeUndefined();
    });

    it('returns undefined when the panel is not found', () => {
      expect(getPrepareTimeseriesSuggestion(999)).toBeUndefined();
    });

    it('returns a suggestion with the correct pluginId and hash', () => {
      const result = getPrepareTimeseriesSuggestion(1);
      expect(result).toBeDefined();
      expect(result!.pluginId).toBe('timeseries');
      expect(result!.hash).toBe('timeseries-transform-prepare-wide');
    });

    it('appends a prepareTimeSeries transformation to the existing list', () => {
      const result = getPrepareTimeseriesSuggestion(1);
      expect(result!.transformations).toHaveLength(1);
      expect(result!.transformations![0].id).toBe('prepareTimeSeries');
      expect(result!.transformations![0].options).toEqual({ format: 'wide' });
    });

    it('preserves existing transformations on the panel', () => {
      const dashboard = createDashboardModelFixture({
        panels: [
          createPanelSaveModel({
            id: 2,
            type: 'timeseries',
            transformations: [{ id: 'reduce', options: {} }],
          }),
        ],
      });
      getDashboardSrv().setCurrent(dashboard);

      const result = getPrepareTimeseriesSuggestion(2);
      expect(result!.transformations).toHaveLength(2);
      expect(result!.transformations![0].id).toBe('reduce');
      expect(result!.transformations![1].id).toBe('prepareTimeSeries');
    });

    it('does not mutate the original panel transformations', () => {
      const dashboard = createDashboardModelFixture({
        panels: [
          createPanelSaveModel({
            id: 3,
            type: 'timeseries',
            transformations: [{ id: 'reduce', options: {} }],
          }),
        ],
      });
      getDashboardSrv().setCurrent(dashboard);

      getPrepareTimeseriesSuggestion(3);
      const panel = getDashboardSrv().getCurrent()!.getPanelById(3)!;
      expect(panel.transformations).toHaveLength(1);
    });
  });
});
