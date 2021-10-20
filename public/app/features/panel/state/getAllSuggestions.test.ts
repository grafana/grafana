import { FieldType, getDefaultTimeRange, LoadingState, PanelData, toDataFrame } from '@grafana/data';
import { config } from 'app/core/config';
import { getAllSuggestions, panelsToCheckFirst } from './getAllSuggestions';

jest.unmock('app/core/core');
jest.unmock('app/features/plugins/plugin_loader');

describe('getAllSuggestions', () => {
  it('wip', async () => {
    const data = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2] },
        { name: 'Max', type: FieldType.number, values: [1, 10, 50] },
      ],
    });

    const panelData: PanelData = {
      series: [data],
      state: LoadingState.Done,
      timeRange: getDefaultTimeRange(),
    };

    for (const pluginId of panelsToCheckFirst) {
      config.panels[pluginId] = {
        module: `app/plugins/panel/${pluginId}/module`,
      } as any;
    }

    const suggestions = await getAllSuggestions(panelData);

    expect(suggestions.length).toBeGreaterThan(1);
  });
});
