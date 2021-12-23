import { PanelPluginMeta } from '@grafana/data';
import { filterPluginList } from './util';

describe('panel state utils', () => {
  it('should include timeseries in a graph query', async () => {
    const pluginsList: PanelPluginMeta[] = [
      { id: 'graph', name: 'Graph (old)' } as any,
      { id: 'timeseries', name: 'Graph (old)' },
      { id: 'timeline', name: 'Timeline' },
    ];
    const found = filterPluginList(pluginsList, 'gra', { id: 'xyz' } as any);
    expect(found.map((v) => v.id)).toEqual(['graph', 'timeseries']);
  });
});
