import {
  DataFrame,
  FieldType,
  getDefaultTimeRange,
  getPanelDataSummary,
  LoadingState,
  PanelData,
  PanelPluginVisualizationSuggestion,
  PluginType,
  toDataFrame,
  VisualizationSuggestionScore,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  BigValueColorMode,
  GraphFieldConfig,
  ReduceDataOptions,
  StackingMode,
  VizOrientation,
} from '@grafana/schema';
import { config } from 'app/core/config';

import { panelsToCheckFirst } from './consts';
import { getAllSuggestions, sortSuggestions } from './getAllSuggestions';

config.featureToggles.externalVizSuggestions = true;

let idx = 0;
for (const pluginId of panelsToCheckFirst) {
  if (pluginId === 'geomap') {
    continue;
  }
  config.panels[pluginId] = {
    id: pluginId,
    module: `core:plugin/${pluginId}`,
    sort: idx++,
    name: pluginId,
    type: PluginType.panel,
    baseUrl: 'public/app/plugins/panel',
    suggestions: true,
    info: {
      version: '1.0.0',
      updated: '2025-01-01',
      links: [],
      screenshots: [],
      author: {
        name: 'Grafana Labs',
      },
      description: pluginId,
      logos: { small: 'small/logo', large: 'large/logo' },
    },
  };
}

config.panels.text = {
  id: 'text',
  module: 'core:plugin/text',
  sort: idx++,
  name: 'Text',
  type: PluginType.panel,
  baseUrl: 'public/app/plugins/panel',
  skipDataQuery: true,
  suggestions: false,
  info: {
    version: '1.0.0',
    updated: '2025-01-01',
    links: [],
    screenshots: [],
    author: {
      name: 'Grafana Labs',
    },
    description: 'Text panel',
    logos: { small: 'small/logo', large: 'large/logo' },
  },
};

jest.mock('../state/util', () => {
  const originalModule = jest.requireActual('../state/util');
  return {
    ...originalModule,
    getAllPanelPluginMeta: jest.fn().mockImplementation(() => [...Object.values(config.panels)]),
  };
});

const SCALAR_PLUGINS = ['gauge', 'stat', 'bargauge', 'piechart', 'radialbar'];

class ScenarioContext {
  data: DataFrame[] = [];
  suggestions: Array<PanelPluginVisualizationSuggestion<{ reduceOptions?: ReduceDataOptions }, GraphFieldConfig>> = [];

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
    expect(ctx.suggestions).toEqual([
      expect.objectContaining({ pluginId: 'table' }),
      expect.objectContaining({ pluginId: 'text' }),
    ]);
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
    expect(ctx.suggestions).toEqual([expect.objectContaining({ pluginId: 'table' })]);
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
    expect(ctx.suggestions).toEqual([
      expect.objectContaining({ pluginId: 'timeseries', name: 'Line chart' }),
      expect.objectContaining({ pluginId: 'timeseries', name: 'Line chart - smooth' }),
      expect.objectContaining({ pluginId: 'timeseries', name: 'Area chart' }),
      expect.objectContaining({ pluginId: 'timeseries', name: 'Bar chart' }),
      expect.objectContaining({ pluginId: 'gauge' }),
      expect.objectContaining({ pluginId: 'gauge', options: expect.objectContaining({ showThresholdMarkers: false }) }),
      expect.objectContaining({ pluginId: 'stat' }),
      expect.objectContaining({
        pluginId: 'stat',
        options: expect.objectContaining({ colorMode: BigValueColorMode.Background }),
      }),
      expect.objectContaining({
        pluginId: 'bargauge',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Basic }),
      }),
      expect.objectContaining({
        pluginId: 'bargauge',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Lcd }),
      }),
      expect.objectContaining({ pluginId: 'table' }),
      expect.objectContaining({ pluginId: 'state-timeline' }),
      expect.objectContaining({ pluginId: 'status-history' }),
      expect.objectContaining({ pluginId: 'heatmap' }),
      expect.objectContaining({ pluginId: 'histogram' }),
    ]);
  });

  it('Bar chart suggestion should be using timeseries panel', () => {
    expect(ctx.suggestions.find((x) => x.name === 'Bar chart')?.pluginId).toBe('timeseries');
  });

  it('Scalar panels should use calcs', () => {
    for (const suggestion of ctx.suggestions.filter((s) => SCALAR_PLUGINS.includes(s.pluginId))) {
      expect(suggestion).toEqual(
        expect.objectContaining({
          options: expect.objectContaining({
            reduceOptions: expect.objectContaining({ values: false, calcs: ['lastNotNull'] }),
          }),
        })
      );
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
    expect(ctx.suggestions).toEqual([
      expect.objectContaining({ pluginId: 'timeseries', name: 'Line chart' }),
      expect.objectContaining({ pluginId: 'timeseries', name: 'Line chart - smooth' }),
      expect.objectContaining({ pluginId: 'timeseries', name: 'Area chart - stacked' }),
      expect.objectContaining({ pluginId: 'timeseries', name: 'Area chart - stacked by percentage' }),
      expect.objectContaining({ pluginId: 'timeseries', name: 'Bar chart - stacked' }),
      expect.objectContaining({ pluginId: 'timeseries', name: 'Bar chart - stacked by percentage' }),
      expect.objectContaining({ pluginId: 'gauge' }),
      expect.objectContaining({ pluginId: 'gauge', options: expect.objectContaining({ showThresholdMarkers: false }) }),
      expect.objectContaining({ pluginId: 'stat' }),
      expect.objectContaining({
        pluginId: 'stat',
        options: expect.objectContaining({ colorMode: BigValueColorMode.Background }),
      }),
      expect.objectContaining({ pluginId: 'piechart' }),
      expect.objectContaining({ pluginId: 'piechart', options: expect.objectContaining({ pieType: 'donut' }) }),
      expect.objectContaining({
        pluginId: 'bargauge',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Basic }),
      }),
      expect.objectContaining({
        pluginId: 'bargauge',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Lcd }),
      }),
      expect.objectContaining({ pluginId: 'table' }),
      expect.objectContaining({ pluginId: 'state-timeline' }),
      expect.objectContaining({ pluginId: 'status-history' }),
      expect.objectContaining({ pluginId: 'heatmap' }),
      expect.objectContaining({ pluginId: 'histogram' }),
    ]);
  });

  it('Scalar panels should use calcs', () => {
    for (const suggestion of ctx.suggestions.filter((s) => SCALAR_PLUGINS.includes(s.pluginId))) {
      expect(suggestion).toEqual(
        expect.objectContaining({
          options: expect.objectContaining({
            reduceOptions: expect.objectContaining({ values: false, calcs: ['lastNotNull'] }),
          }),
        })
      );
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
    expect(ctx.suggestions.find((x) => x.name === 'Bar chart')).toBe(undefined);
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
    expect(ctx.suggestions).toEqual([
      expect.objectContaining({ pluginId: 'piechart' }),
      expect.objectContaining({ pluginId: 'piechart', options: expect.objectContaining({ pieType: 'donut' }) }),
      expect.objectContaining({ pluginId: 'barchart' }),
      expect.objectContaining({
        pluginId: 'barchart',
        options: expect.objectContaining({ orientation: VizOrientation.Horizontal }),
      }),
      expect.objectContaining({ pluginId: 'gauge' }),
      expect.objectContaining({ pluginId: 'gauge', options: expect.objectContaining({ showThresholdMarkers: false }) }),
      expect.objectContaining({ pluginId: 'stat' }),
      expect.objectContaining({
        pluginId: 'stat',
        options: expect.objectContaining({ colorMode: BigValueColorMode.Background }),
      }),
      expect.objectContaining({
        pluginId: 'bargauge',
      }),
      expect.objectContaining({
        pluginId: 'bargauge',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Lcd }),
      }),
      expect.objectContaining({ pluginId: 'table' }),
      expect.objectContaining({ pluginId: 'histogram' }),
    ]);
  });

  it('Scalar panels should contain raw values', () => {
    for (const suggestion of ctx.suggestions.filter((s) => SCALAR_PLUGINS.includes(s.pluginId))) {
      expect(suggestion).toEqual(
        expect.objectContaining({
          options: expect.objectContaining({ reduceOptions: expect.objectContaining({ values: true, calcs: [] }) }),
        })
      );
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
    expect(ctx.suggestions).toEqual([
      expect.objectContaining({ pluginId: 'barchart' }),
      expect.objectContaining({
        pluginId: 'barchart',
        options: expect.objectContaining({ stacking: StackingMode.Normal }),
      }),
      expect.objectContaining({
        pluginId: 'barchart',
        options: expect.objectContaining({ stacking: StackingMode.Percent }),
      }),

      expect.objectContaining({
        pluginId: 'barchart',
        options: expect.objectContaining({ orientation: VizOrientation.Horizontal }),
      }),
      expect.objectContaining({
        pluginId: 'barchart',
        options: expect.objectContaining({ orientation: VizOrientation.Horizontal, stacking: StackingMode.Normal }),
      }),
      expect.objectContaining({
        pluginId: 'barchart',
        options: expect.objectContaining({ orientation: VizOrientation.Horizontal, stacking: StackingMode.Percent }),
      }),
      expect.objectContaining({ pluginId: 'gauge' }),
      expect.objectContaining({ pluginId: 'gauge', options: expect.objectContaining({ showThresholdMarkers: false }) }),
      expect.objectContaining({ pluginId: 'stat' }),
      expect.objectContaining({
        pluginId: 'stat',
        options: expect.objectContaining({ colorMode: BigValueColorMode.Background }),
      }),
      expect.objectContaining({ pluginId: 'piechart' }),
      expect.objectContaining({ pluginId: 'piechart', options: expect.objectContaining({ pieType: 'donut' }) }),
      expect.objectContaining({
        pluginId: 'bargauge',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Basic }),
      }),
      expect.objectContaining({
        pluginId: 'bargauge',
        options: expect.objectContaining({ displayMode: BarGaugeDisplayMode.Lcd }),
      }),
      expect.objectContaining({ pluginId: 'table' }),
      expect.objectContaining({ pluginId: 'histogram' }),
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
    expect(ctx.suggestions).toEqual([
      expect.objectContaining({ pluginId: 'stat' }),
      expect.objectContaining({ pluginId: 'table' }),
    ]);
  });

  it('Stat panels have reduceOptions.fields set to show all fields', () => {
    for (const suggestion of ctx.suggestions.filter((s) => s.pluginId === 'stat')) {
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
    expect(ctx.suggestions).toEqual([
      expect.objectContaining({ pluginId: 'logs' }),
      expect.objectContaining({ pluginId: 'table' }),
    ]);
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
    expect(ctx.suggestions[0]).toEqual(expect.objectContaining({ pluginId: 'table' }));
  });
});

describe('sortSuggestions', () => {
  it('should sort suggestions correctly by score', () => {
    const suggestions = [
      { pluginId: 'timeseries', name: 'Time series', hash: 'b', score: VisualizationSuggestionScore.OK },
      { pluginId: 'table', name: 'Table', hash: 'a', score: VisualizationSuggestionScore.OK },
      { pluginId: 'stat', name: 'Stat', hash: 'c', score: VisualizationSuggestionScore.Good },
    ] satisfies PanelPluginVisualizationSuggestion[];

    const dataSummary = getPanelDataSummary([
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
          { name: 'ServerA', type: FieldType.number, values: [1, 10, 50, 2, 5] },
          { name: 'ServerB', type: FieldType.number, values: [1, 10, 50, 2, 5] },
        ],
      }),
    ]);

    sortSuggestions(suggestions, dataSummary);

    expect(suggestions[0].pluginId).toBe('stat');
    expect(suggestions[1].pluginId).toBe('timeseries');
    expect(suggestions[2].pluginId).toBe('table');
  });

  it('should sort suggestions based on core module', () => {
    const suggestions = [
      {
        pluginId: 'fake-external-panel',
        name: 'Time series',
        hash: 'b',
        score: VisualizationSuggestionScore.Good,
      },
      {
        pluginId: 'fake-external-panel',
        name: 'Time series',
        hash: 'd',
        score: VisualizationSuggestionScore.Best,
      },
      { pluginId: 'timeseries', name: 'Table', hash: 'a', score: VisualizationSuggestionScore.OK },
      { pluginId: 'stat', name: 'Stat', hash: 'c', score: VisualizationSuggestionScore.Good },
    ] satisfies PanelPluginVisualizationSuggestion[];

    const dataSummary = getPanelDataSummary([
      toDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
          { name: 'ServerA', type: FieldType.number, values: [1, 10, 50, 2, 5] },
          { name: 'ServerB', type: FieldType.number, values: [1, 10, 50, 2, 5] },
        ],
      }),
    ]);

    sortSuggestions(suggestions, dataSummary);

    expect(suggestions[0].pluginId).toBe('stat');
    expect(suggestions[1].pluginId).toBe('timeseries');
    expect(suggestions[2].pluginId).toBe('fake-external-panel');
    expect(suggestions[2].hash).toBe('d');
    expect(suggestions[3].pluginId).toBe('fake-external-panel');
    expect(suggestions[3].hash).toBe('b');
  });
});

function repeatFrame(count: number, frame: DataFrame): DataFrame[] {
  const frames: DataFrame[] = [];
  for (let i = 0; i < count; i++) {
    frames.push(frame);
  }
  return frames;
}
