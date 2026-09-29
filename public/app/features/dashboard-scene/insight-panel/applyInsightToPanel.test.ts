import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { applyInsightToPanel } from './applyInsightToPanel';
import { type InsightDataQuery, type InsightPanelConfig } from './types';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

const mockGetDataSourceInstanceList = getDataSourceInstanceList as jest.MockedFunction<
  typeof getDataSourceInstanceList
>;

const mockTestDataSource = { uid: 'gdev-testdata', type: 'testdata', name: 'gdev-testdata' };

const config: InsightPanelConfig = {
  prompt: 'Show insights of this panel or panels',
  context: {
    scope: 'panels',
    dashboardUid: 'test-uid',
    dashboardTitle: 'Test dashboard',
    panels: [{ panelId: 2, panelTitle: 'Request latency' }],
  },
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
    mockGetDataSourceInstanceList.mockResolvedValue([mockTestDataSource as never]);

    dashboard = new DashboardScene({
      title: 'Test dashboard',
      uid: 'test-uid',
      body: DefaultGridLayoutManager.createEmpty(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockApplySetup(queryRunner: SceneQueryRunner) {
    jest.spyOn(dashboard, 'changePanelPlugin').mockResolvedValue(undefined);
    jest.spyOn(dashboard, 'updatePanelTitle').mockImplementation(() => {});
    jest.spyOn(queryRunner, 'runQueries').mockImplementation(() => {});
  }

  it('turns the panel into a text panel rendering the insight field', async () => {
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    mockApplySetup(queryRunner);

    await applyInsightToPanel(dashboard, panel, config);

    expect(dashboard.changePanelPlugin).toHaveBeenCalledWith(panel, 'text', {
      mode: 'markdown',
      renderMode: 'once',
      content: '{{{data.[0].insight}}}',
    });
    expect(dashboard.updatePanelTitle).toHaveBeenCalledWith(panel, 'Insights');
  });

  it('sets a query carrying the prompt and panel context, and runs it', async () => {
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    mockApplySetup(queryRunner);

    await applyInsightToPanel(dashboard, panel, config);

    expect(queryRunner.state.datasource).toEqual({ type: 'testdata', uid: 'gdev-testdata' });

    const [query] = queryRunner.state.queries as InsightDataQuery[];
    expect(query.prompt).toBe(config.prompt);
    expect(query.insightContext).toEqual(config.context);
    expect(queryRunner.runQueries).toHaveBeenCalled();
  });

  it('mocks the response with a testdata raw frame holding markdown', async () => {
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    mockApplySetup(queryRunner);

    await applyInsightToPanel(dashboard, panel, config);

    const [query] = queryRunner.state.queries as InsightDataQuery[];
    expect(query.scenarioId).toBe('raw_frame');

    const [frame] = JSON.parse(query.rawFrameContent);
    expect(frame.fields[0].name).toBe('insight');
    expect(frame.fields[0].values[0]).toContain('Request latency');
  });

  it('leaves the datasource unset when no testdata instance exists', async () => {
    mockGetDataSourceInstanceList.mockResolvedValue([]);
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    mockApplySetup(queryRunner);

    await applyInsightToPanel(dashboard, panel, config);

    expect(queryRunner.state.datasource).toBeUndefined();
    expect(queryRunner.state.queries).toHaveLength(1);
  });
});
