import { getPanelPlugin } from '@grafana/data/test';
import { locationService } from '@grafana/runtime';
import { SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { type GetExploreUrlArguments } from 'app/core/utils/explore';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import { focusVizPanel } from 'app/features/dashboard-scene/utils/focusPanel';

import { followLink } from './followLink';

const mockGetExploreUrl = jest.fn();
jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  getExploreUrl: (options: GetExploreUrlArguments) => mockGetExploreUrl(options),
}));
jest.mock('app/core/services/context_srv');
jest.mock('app/features/dashboard-scene/utils/focusPanel', () => ({ focusVizPanel: jest.fn() }));

function buildScene({ canEdit = true, editable = true } = {}) {
  const panel = new VizPanel({
    title: 'Requests',
    pluginId: 'timeseries',
    key: 'panel-4',
    $data: new SceneQueryRunner({ datasource: { uid: 'ds-uid' }, queries: [{ refId: 'A', expr: 'up' }] }),
  });
  panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });
  const scene = new DashboardScene({
    title: 'Links',
    uid: 'links',
    meta: { canEdit },
    editable,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });
  window.__grafanaSceneContext = scene;
  return { scene, panel };
}

describe('followLink', () => {
  beforeEach(() => {
    jest.mocked(contextSrv.hasAccessToExplore).mockReturnValue(true);
    mockGetExploreUrl.mockResolvedValue('/explore?panes=x');
    jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    jest.spyOn(locationService, 'push').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(focusVizPanel).mockClear();
    mockGetExploreUrl.mockReset();
  });

  it('opens the panel editor for a user who can edit the dashboard', async () => {
    buildScene();
    await followLink({ kind: 'dashboard-state', params: { editPanel: 'panel-4', 'var-env': 'prod' } });

    expect(locationService.partial).toHaveBeenCalledWith({ editPanel: 'panel-4', 'var-env': 'prod' });
  });

  it.each([
    ['cannot edit the dashboard', { canEdit: false }],
    ['the dashboard is not editable', { editable: false }],
  ])('ignores an editPanel link when the user %s', async (_, options) => {
    buildScene(options);
    await followLink({ kind: 'dashboard-state', params: { editPanel: 'panel-4', dtab: 'a' } });

    expect(locationService.partial).not.toHaveBeenCalled();
  });

  it('ignores an editPanel link to a panel that is not on the dashboard', async () => {
    buildScene();
    await followLink({ kind: 'dashboard-state', params: { editPanel: 'panel-9' } });

    expect(locationService.partial).not.toHaveBeenCalled();
  });

  it('opens Explore with the queries, datasource and time range of the panel', async () => {
    const { panel } = buildScene();
    await followLink({ kind: 'explore-panel', panelId: 4 });

    const args: GetExploreUrlArguments = mockGetExploreUrl.mock.calls[0][0];
    expect(args.queries).toEqual([{ refId: 'A', expr: 'up' }]);
    expect(args.dsRef).toEqual({ uid: 'ds-uid' });
    expect(args.timeRange.raw).toEqual({ from: 'now-6h', to: 'now' });
    expect(args.scopedVars?.__sceneObject?.value).toBe(panel);
    expect(locationService.push).toHaveBeenCalledWith('/explore?panes=x');
  });

  it('does not open Explore without Explore access', async () => {
    buildScene();
    jest.mocked(contextSrv.hasAccessToExplore).mockReturnValue(false);
    await followLink({ kind: 'explore-panel', panelId: 4 });

    expect(mockGetExploreUrl).not.toHaveBeenCalled();
    expect(locationService.push).not.toHaveBeenCalled();
  });

  it('does not open Explore for a panel that is not on the dashboard', async () => {
    buildScene();
    await followLink({ kind: 'explore-panel', panelId: 9 });

    expect(locationService.push).not.toHaveBeenCalled();
  });

  it('focuses the panel of a #focus-panel link', async () => {
    const { panel } = buildScene();
    await followLink({ kind: 'focus-panel', panelId: 4 });

    expect(focusVizPanel).toHaveBeenCalledWith(panel);
  });

  it('ignores a #focus-panel link to a panel that is not on the dashboard', async () => {
    buildScene();
    await followLink({ kind: 'focus-panel', panelId: 9 });

    expect(focusVizPanel).not.toHaveBeenCalled();
  });
});
