import {
  DataFrame,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  toDataFrame,
  VisualizationSuggestion,
} from '@grafana/data';
import { config } from 'app/core/config';
import { SuggestionName } from 'app/types/suggestions';
import { getAllSuggestions, panelsToCheckFirst } from './getAllSuggestions';

jest.unmock('app/core/core');
jest.unmock('app/features/plugins/plugin_loader');

for (const pluginId of panelsToCheckFirst) {
  config.panels[pluginId] = {
    module: `app/plugins/panel/${pluginId}/module`,
  } as any;
}

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

  expectSuggestions(names: string[]) {
    for (const name of names) {
      it(`${name} should be suggested`, () => {
        expect(this.suggestions.find((x) => x.name === name)).toBeDefined();
      });
    }
  }
}

function scenario(name: string, setup: (ctx: ScenarioContext) => void) {
  describe(name, () => {
    const ctx = new ScenarioContext();
    setup(ctx);
  });
}

scenario('Single data frame with time and number field', (ctx) => {
  ctx.setData([
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
        { name: 'Max', type: FieldType.number, values: [1, 10, 50, 2, 5] },
      ],
    }),
  ]);

  ctx.expectSuggestions([
    SuggestionName.LineChart,
    SuggestionName.BarChart,
    SuggestionName.PieChart,
    SuggestionName.PieChartDonut,
    SuggestionName.Stat,
    SuggestionName.StatColoredBackground,
  ]);
});
