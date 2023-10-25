import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { locationService } from '@grafana/runtime';
import { SceneGridItem, SceneGridLayout, SceneQueryRunner, VizPanel, VizPanelMenu } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { GetExploreUrlArguments } from 'app/core/utils/explore';

import { DashboardScene } from './DashboardScene';
import { panelMenuBehavior } from './PanelMenuBehavior';

const mocks = {
  contextSrv: jest.mocked(contextSrv),
  getExploreUrl: jest.fn(),
};

jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  getExploreUrl: (options: GetExploreUrlArguments) => {
    return mocks.getExploreUrl(options);
  },
}));

jest.mock('app/core/services/context_srv');

describe('panelMenuBehavior', () => {
  beforeAll(() => {
    locationService.push('/scenes/dashboard/dash-1?from=now-5m&to=now');
  });

  it('Given standard panel', async () => {
    const { menu, panel } = await buildTestScene({});

    Object.assign(panel, 'getPlugin', () => getPanelPlugin({}));

    mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
    mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

    menu.activate();

    await new Promise((r) => setTimeout(r, 1));

    expect(menu.state.items?.length).toBe(5);
    // verify view panel url keeps url params and adds viewPanel=<panel-key>
    expect(menu.state.items?.[0].href).toBe('/scenes/dashboard/dash-1?from=now-5m&to=now&viewPanel=panel-12');
    // verify edit url keeps url time range
    expect(menu.state.items?.[1].href).toBe('/scenes/dashboard/dash-1/panel-edit/12?from=now-5m&to=now');
    // verify share
    expect(menu.state.items?.[2].text).toBe('Share');
    // verify explore url
    expect(menu.state.items?.[3].href).toBe('/explore');

    // Verify explore url is called with correct arguments
    const getExploreArgs: GetExploreUrlArguments = mocks.getExploreUrl.mock.calls[0][0];
    expect(getExploreArgs.dsRef).toEqual({ uid: 'my-uid' });
    expect(getExploreArgs.queries).toEqual([{ query: 'buu', refId: 'A' }]);
    expect(getExploreArgs.scopedVars?.__sceneObject?.value).toBe(panel);

    // verify inspect url keeps url params and adds inspect=<panel-key>
    expect(menu.state.items?.[4].href).toBe('/scenes/dashboard/dash-1?from=now-5m&to=now&inspect=panel-12');
  });
});

interface SceneOptions {}

async function buildTestScene(options: SceneOptions) {
  const menu = new VizPanelMenu({
    $behaviors: [panelMenuBehavior],
  });

  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
    menu,
    $data: new SceneQueryRunner({
      datasource: { uid: 'my-uid' },
      queries: [{ query: 'buu', refId: 'A' }],
    }),
  });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: new SceneGridLayout({
      children: [
        new SceneGridItem({
          key: 'griditem-1',
          x: 0,
          y: 0,
          width: 10,
          height: 12,
          body: panel,
        }),
      ],
    }),
  });

  await new Promise((r) => setTimeout(r, 1));

  return { scene, panel, menu };
}
