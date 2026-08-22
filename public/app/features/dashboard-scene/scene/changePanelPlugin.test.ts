import { getPanelPlugin } from '@grafana/data/test';
import { setDataSourceSrv, setPluginImportUtils, type DataSourceSrv } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
setDataSourceSrv({ getInstanceSettings: () => undefined } as unknown as DataSourceSrv);

import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

describe('DashboardScene.changePanelPlugin', () => {
  function buildScene(panel: VizPanel) {
    return new DashboardScene({
      title: 'Test dashboard',
      uid: 'test-uid',
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    });
  }

  it('carries existing overrides across a plugin change', async () => {
    const panel = new VizPanel({
      pluginId: 'timeseries',
      title: 'Has field config',
      fieldConfig: {
        defaults: { unit: 'bytes', custom: { lineWidth: 3 } },
        overrides: [{ matcher: { id: 'byName', options: 'A' }, properties: [{ id: 'unit', value: 'percent' }] }],
      },
    });

    const scene = buildScene(panel);

    await scene.changePanelPlugin(panel, 'stat');

    // Standard defaults are re-derived against the new plugin's registry, but
    // the existing overrides must still be carried across.
    expect(panel.state.fieldConfig.overrides).toEqual([
      expect.objectContaining({ matcher: { id: 'byName', options: 'A' } }),
    ]);
  });
});
