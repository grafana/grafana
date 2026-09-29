import { SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { type InsightOptions } from 'app/plugins/panel/text/panelcfg.gen';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { applyInsightToPanel } from './applyInsightToPanel';

const insight: InsightOptions = {
  question: 'Why did errors spike?',
  sourcePanelKeys: ['panel-2', 'section:["LLM usage"]'],
  followUps: ['Which service drove it?'],
};

function buildPanelWithQueryRunner() {
  const queryRunner = new SceneQueryRunner({ queries: [] });
  const panel = new VizPanel({ pluginId: '__unconfigured-panel', $data: queryRunner });
  return { panel, queryRunner };
}

describe('applyInsightToPanel', () => {
  let dashboard: DashboardScene;

  beforeEach(() => {
    jest.clearAllMocks();
    dashboard = new DashboardScene({
      title: 'Test dashboard',
      uid: 'test-uid',
      body: DefaultGridLayoutManager.createEmpty(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockApplySetup() {
    jest.spyOn(dashboard, 'changePanelPlugin').mockResolvedValue(undefined);
    jest.spyOn(dashboard, 'updatePanelTitle').mockImplementation(() => {});
  }

  it('turns the panel into a text panel in insight mode carrying the configured options', async () => {
    const { panel } = buildPanelWithQueryRunner();
    mockApplySetup();

    await applyInsightToPanel(dashboard, panel, insight);

    expect(dashboard.changePanelPlugin).toHaveBeenCalledWith(panel, 'text', {
      mode: 'insight',
      insight,
    });
    expect(dashboard.updatePanelTitle).toHaveBeenCalledWith(panel, 'Insights');
  });

  it('removes the query runner, since insight mode reads its sources and not its own data', async () => {
    const { panel } = buildPanelWithQueryRunner();
    mockApplySetup();

    await applyInsightToPanel(dashboard, panel, insight);

    expect(panel.state.$data).toBeUndefined();
  });

  it('applies cleanly to a panel that never had a query runner', async () => {
    const panel = new VizPanel({ pluginId: '__unconfigured-panel' });
    mockApplySetup();

    await applyInsightToPanel(dashboard, panel, insight);

    expect(dashboard.changePanelPlugin).toHaveBeenCalled();
    expect(panel.state.$data).toBeUndefined();
  });
});
