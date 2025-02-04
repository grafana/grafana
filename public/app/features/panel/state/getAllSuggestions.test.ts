import {
  DataFrame,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  PanelPluginMeta,
  toDataFrame,
  VisualizationSuggestion,
} from '@grafana/data';
import { config } from 'app/core/config';
import { SuggestionName } from 'app/types/suggestions';

import { getAllSuggestions, panelsToCheckFirst } from './getAllSuggestions';

for (const pluginId of panelsToCheckFirst) {
  config.panels[pluginId] = {
    module: `core:plugin/${pluginId}`,
  } as PanelPluginMeta;
}

config.panels['text'] = {
  id: 'text',
  name: 'Text',
  skipDataQuery: true,
  info: {
    description: 'pretty decent plugin',
    logos: { small: 'small/logo', large: 'large/logo' },
  },
} as PanelPluginMeta;

class ScenarioContext {
  data: DataFrame[] = [];
  suggestions: VisualizationSuggestion[] = [];

  setData(scenarioData: DataFrame[]) {
    this.data = scenarioData;

    beforeAll(async () => {
      await this.run();
    });
  }

  async run() {
    const panelData: PanelData = {
      series: this.data,
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    };

    this.suggestions = await getAllSuggestions(panelData);
  }

  names() {
    return this.suggestions.map((x) => x.name);
  }
}

function scenario(name: string, setup: (ctx: ScenarioContext) => void) {
  describe(name, () => {
    const ctx = new ScenarioContext();
    setup(ctx);
  });
}

scenario('No series', (ctx) => {
  ctx.setData([]);

  it('should return correct suggestions', () => {
    expect(ctx.names()).toEqual([SuggestionName.Table, SuggestionName.TextPanel]);
  });
});

scenario('No rows', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [] },
        { name: 'Max', type: FieldType.number, values: [] },
      ],
    }),
  ]);

  it('should return correct suggestions', () => {
    expect(ctx.names()).toEqual([SuggestionName.Table]);
  });
});

scenario('Single frame with time and number field', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
        { name: 'Max', type: FieldType.number, values: [1, 10, 50, 2, 5] },
      ],
    }),
  ]);

  it('should return correct suggestions', () => {
    expect(ctx.names()).toEqual([
      SuggestionName.LineChart,
      SuggestionName.LineChartSmooth,
      SuggestionName.AreaChart,
      SuggestionName.LineChartGradientColorScheme,
      SuggestionName.BarChart,
      SuggestionName.BarChartGradientColorScheme,
      SuggestionName.Gauge,
      SuggestionName.GaugeNoThresholds,
      SuggestionName.Stat,
      SuggestionName.StatColoredBackground,
      SuggestionName.BarGaugeBasic,
      SuggestionName.BarGaugeLCD,
      SuggestionName.Table,
      SuggestionName.StateTimeline,
      SuggestionName.StatusHistory,
    ]);
  });

  it('Bar chart suggestion should be using timeseries panel', () => {
    expect(ctx.suggestions.find((x) => x.name === SuggestionName.BarChart)?.pluginId).toBe('timeseries');
  });

  it('Stat panels have reduce values disabled', () => {
    for (const suggestion of ctx.suggestions) {
      if (suggestion.options?.reduceOptions?.values) {
        throw new Error(`Suggestion ${suggestion.name} reduce.values set to true when it should be false`);
      }
    }
  });
});

scenario('Single frame with time 2 number fields', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
        { name: 'ServerA', type: FieldType.number, values: [1, 10, 50, 2, 5] },
        { name: 'ServerB', type: FieldType.number, values: [1, 10, 50, 2, 5] },
      ],
    }),
  ]);

  it('should return correct suggestions', () => {
    expect(ctx.names()).toEqual([
      SuggestionName.LineChart,
      SuggestionName.LineChartSmooth,
      SuggestionName.AreaChartStacked,
      SuggestionName.AreaChartStackedPercent,
      SuggestionName.BarChartStacked,
      SuggestionName.BarChartStackedPercent,
      SuggestionName.Gauge,
      SuggestionName.GaugeNoThresholds,
      SuggestionName.Stat,
      SuggestionName.StatColoredBackground,
      SuggestionName.PieChart,
      SuggestionName.PieChartDonut,
      SuggestionName.BarGaugeBasic,
      SuggestionName.BarGaugeLCD,
      SuggestionName.Table,
      SuggestionName.StateTimeline,
      SuggestionName.StatusHistory,
    ]);
  });

  it('Stat panels have reduceOptions.values disabled', () => {
    for (const suggestion of ctx.suggestions) {
      if (suggestion.options?.reduceOptions?.values) {
        throw new Error(`Suggestion ${suggestion.name} reduce.values set to true when it should be false`);
      }
    }
  });
});

scenario('Single time series with 100 data points', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [...Array(100).keys()] },
        { name: 'ServerA', type: FieldType.number, values: [...Array(100).keys()] },
      ],
    }),
  ]);

  it('should not suggest bar chart', () => {
    expect(ctx.suggestions.find((x) => x.name === SuggestionName.BarChart)).toBe(undefined);
  });
});

scenario('30 time series with 100 data points', (ctx) => {
  ctx.setData(
    repeatFrame(
      30,
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [...Array(100).keys()] },
          { name: 'ServerA', type: FieldType.number, values: [...Array(100).keys()] },
        ],
      })
    )
  );

  it('should not suggest timeline', () => {
    expect(ctx.suggestions.find((x) => x.pluginId === 'state-timeline')).toBe(undefined);
  });
});

scenario('50 time series with 100 data points', (ctx) => {
  ctx.setData(
    repeatFrame(
      50,
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [...Array(100).keys()] },
          { name: 'ServerA', type: FieldType.number, values: [...Array(100).keys()] },
        ],
      })
    )
  );

  it('should not suggest gauge', () => {
    expect(ctx.suggestions.find((x) => x.pluginId === 'gauge')).toBe(undefined);
  });
});

scenario('Single frame with string and number field', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['Hugo', 'Dominik', 'Marcus'] },
        { name: 'ServerA', type: FieldType.number, values: [1, 2, 3] },
      ],
    }),
  ]);

  it('should return correct suggestions', () => {
    expect(ctx.names()).toEqual([
      SuggestionName.BarChart,
      SuggestionName.BarChartHorizontal,
      SuggestionName.Gauge,
      SuggestionName.GaugeNoThresholds,
      SuggestionName.Stat,
      SuggestionName.StatColoredBackground,
      SuggestionName.PieChart,
      SuggestionName.PieChartDonut,
      SuggestionName.BarGaugeBasic,
      SuggestionName.BarGaugeLCD,
      SuggestionName.Table,
    ]);
  });

  it('Stat/Gauge/BarGauge/PieChart panels to have reduceOptions.values enabled', () => {
    for (const suggestion of ctx.suggestions) {
      if (suggestion.options?.reduceOptions && !suggestion.options?.reduceOptions?.values) {
        throw new Error(`Suggestion ${suggestion.name} reduce.values set to false when it should be true`);
      }
    }
  });
});

scenario('Single frame with string and 2 number field', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [
        { name: 'Name', type: FieldType.string, values: ['Hugo', 'Dominik', 'Marcus'] },
        { name: 'ServerA', type: FieldType.number, values: [1, 2, 3] },
        { name: 'ServerB', type: FieldType.number, values: [1, 2, 3] },
      ],
    }),
  ]);

  it('should return correct suggestions', () => {
    expect(ctx.names()).toEqual([
      SuggestionName.BarChart,
      SuggestionName.BarChartStacked,
      SuggestionName.BarChartStackedPercent,
      SuggestionName.BarChartHorizontal,
      SuggestionName.BarChartHorizontalStacked,
      SuggestionName.BarChartHorizontalStackedPercent,
      SuggestionName.Gauge,
      SuggestionName.GaugeNoThresholds,
      SuggestionName.Stat,
      SuggestionName.StatColoredBackground,
      SuggestionName.PieChart,
      SuggestionName.PieChartDonut,
      SuggestionName.BarGaugeBasic,
      SuggestionName.BarGaugeLCD,
      SuggestionName.Table,
    ]);
  });
});

scenario('Single frame with only string field', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [{ name: 'Name', type: FieldType.string, values: ['Hugo', 'Dominik', 'Marcus'] }],
    }),
  ]);

  it('should return correct suggestions', () => {
    expect(ctx.names()).toEqual([SuggestionName.Stat, SuggestionName.Table]);
  });

  it('Stat panels have reduceOptions.fields set to show all fields', () => {
    for (const suggestion of ctx.suggestions) {
      if (suggestion.options?.reduceOptions) {
        expect(suggestion.options.reduceOptions.fields).toBe('/.*/');
      }
    }
  });
});

scenario('Given default loki logs data', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [
        { name: 'ts', type: FieldType.time, values: ['2021-11-11T13:38:45.440Z', '2021-11-11T13:38:45.190Z'] },
        {
          name: 'line',
          type: FieldType.string,
          values: [
            't=2021-11-11T14:38:45+0100 lvl=dbug msg="Client connected" logger=live user=1 client=ee79155b-a8d1-4730-bcb3-94d8690df35c',
            't=2021-11-11T14:38:45+0100 lvl=dbug msg="Adding CSP header to response" logger=http.server cfg=0xc0005fed00',
          ],
          labels: { filename: '/var/log/grafana/grafana.log', job: 'grafana' },
        },
      ],
      meta: {
        preferredVisualisationType: 'logs',
      },
    }),
  ]);

  it('should return correct suggestions', () => {
    expect(ctx.names()).toEqual([SuggestionName.Logs, SuggestionName.Table]);
  });
});

scenario('Given a preferredVisualisationType', (ctx) => {
  ctx.setData([
    toDataFrame({
      meta: {
        preferredVisualisationType: 'table',
      },
      fields: [
        {
          name: 'Trace Id',
          type: FieldType.number,
          values: [1, 2, 3],
          config: {},
        },
        { name: 'Trace Group', type: FieldType.string, values: ['traceGroup1', 'traceGroup2', 'traceGroup3'] },
      ],
    }),
  ]);

  it('should return the preferred visualization first', () => {
    expect(ctx.names()[0]).toEqual(SuggestionName.Table);
  });
});

function repeatFrame(count: number, frame: DataFrame): DataFrame[] {
  const frames: DataFrame[] = [];
  for (let i = 0; i < count; i++) {
    frames.push(frame);
  }
  return frames;
}
