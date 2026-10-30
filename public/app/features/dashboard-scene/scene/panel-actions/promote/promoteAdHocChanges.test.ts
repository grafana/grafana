import { type PanelInteraction } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { DashboardScene } from '../../DashboardScene';
import { DefaultGridLayoutManager } from '../../layout-default/DefaultGridLayoutManager';

import { promoteAdHocChanges } from './promoteAdHocChanges';

const hideColumn = [{ id: 'organize', options: { excludeByName: { a: true } } }];
const context = { elementKey: 'panel-1', transformations: hideColumn };

const promotions: Record<string, jest.Mock> = {
  first: jest.fn(),
  second: jest.fn(),
};

function interaction(name: string): PanelInteraction {
  return { id: 0, name, mutates: ['TRANSFORMATION'], schema: [], promotionPath: promotions[name] };
}

setPluginImportUtils({
  importPanelPlugin: () =>
    Promise.resolve(
      getPanelPlugin({ id: 'table' }).setPanelInteractions({
        interactions: [interaction('first'), interaction('second')],
      })
    ),
  getPanelPluginFromCache: () => undefined,
});

async function buildScene(version: 'v1' | 'v2' = 'v2') {
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'table' });
  const dashboard = new DashboardScene(
    {
      title: 'My dashboard',
      body: DefaultGridLayoutManager.fromVizPanels([panel]),
    },
    version
  );
  // Loaded dashboards keep the JSON they were built from.
  dashboard.serializer.initialSaveModel = dashboard.getSaveModel();
  activateFullSceneTree(dashboard);
  await new Promise((r) => setTimeout(r, 1));
  panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, hideColumn);
  return { panel, dashboard };
}

describe('promoteAdHocChanges', () => {
  beforeEach(() => {
    promotions.first.mockReset().mockImplementation((json) => ({ ...json, title: `${json.title} (promoted)` }));
    promotions.second.mockReset().mockImplementation((json) => json);
  });

  it('passes the v2 dashboard JSON, the panel element key and its ad hoc transformations to the first promotion path', async () => {
    const { panel } = await buildScene();

    promoteAdHocChanges(panel);

    expect(promotions.first).toHaveBeenCalledTimes(1);
    expect(promotions.first).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My dashboard', elements: expect.any(Object) }),
      context
    );
  });

  it('feeds each promotion the JSON returned by the previous one and returns the last result', async () => {
    const { panel } = await buildScene();

    const result = promoteAdHocChanges(panel);

    expect(promotions.second).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My dashboard (promoted)' }),
      context
    );
    expect(result).toMatchObject({ title: 'My dashboard (promoted)' });
  });

  it('does not promote into a v1 dashboard', async () => {
    const { panel } = await buildScene('v1');

    const result = promoteAdHocChanges(panel);

    expect(result).toBeUndefined();
    expect(promotions.first).not.toHaveBeenCalled();
    expect(promotions.second).not.toHaveBeenCalled();
  });
});
