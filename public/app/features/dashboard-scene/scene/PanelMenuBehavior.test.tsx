import {
  FieldType,
  LoadingState,
  PanelData,
  PluginExtensionPanelContext,
  PluginExtensionTypes,
  getDefaultTimeRange,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { getPluginLinkExtensions, locationService } from '@grafana/runtime';
import {
  LocalValueVariable,
  SceneGridItem,
  SceneGridLayout,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { GetExploreUrlArguments } from 'app/core/utils/explore';

import { DashboardScene } from './DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from './PanelLinks';
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

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn(),
}));

const getPluginLinkExtensionsMock = jest.mocked(getPluginLinkExtensions);

describe('panelMenuBehavior', () => {
  beforeEach(() => {
    getPluginLinkExtensionsMock.mockRestore();
    getPluginLinkExtensionsMock.mockReturnValue({ extensions: [] });
  });

  beforeAll(() => {
    locationService.push('/d/dash-1?from=now-5m&to=now');
  });

  it('Given standard panel', async () => {
    const { menu, panel } = await buildTestScene({});

    panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

    mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
    mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

    menu.activate();

    await new Promise((r) => setTimeout(r, 1));

    expect(menu.state.items?.length).toBe(6);
    // verify view panel url keeps url params and adds viewPanel=<panel-key>
    expect(menu.state.items?.[0].href).toBe('/d/dash-1?from=now-5m&to=now&viewPanel=panel-12');
    // verify edit url keeps url time range
    expect(menu.state.items?.[1].href).toBe('/d/dash-1?from=now-5m&to=now&editPanel=12');
    // verify share
    expect(menu.state.items?.[2].text).toBe('Share');
    // verify explore url
    expect(menu.state.items?.[3].href).toBe('/explore');

    // Verify explore url is called with correct arguments
    const getExploreArgs: GetExploreUrlArguments = mocks.getExploreUrl.mock.calls[0][0];
    expect(getExploreArgs.dsRef).toEqual({ uid: 'my-uid' });
    expect(getExploreArgs.queries).toEqual([{ query: 'QueryA', refId: 'A' }]);
    expect(getExploreArgs.scopedVars?.__sceneObject?.value).toBe(panel);

    // verify inspect url keeps url params and adds inspect=<panel-key>
    expect(menu.state.items?.[4].href).toBe('/d/dash-1?from=now-5m&to=now&inspect=panel-12');
    expect(menu.state.items?.[4].subMenu).toBeDefined();

    expect(menu.state.items?.[4].subMenu?.length).toBe(3);
  });

  describe('when extending panel menu from plugins', () => {
    it('should contain menu item from link extension', async () => {
      getPluginLinkExtensionsMock.mockReturnValue({
        extensions: [
          {
            id: '1',
            pluginId: '...',
            type: PluginExtensionTypes.link,
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: '/a/grafana-basic-app/declare-incident',
          },
        ],
      });

      const { menu, panel } = await buildTestScene({});

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.length).toBe(7);

      const extensionsSubMenu = menu.state.items?.find((i) => i.text === 'Extensions')?.subMenu;

      expect(extensionsSubMenu).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Declare incident',
            href: '/a/grafana-basic-app/declare-incident',
          }),
        ])
      );
    });

    it('should truncate menu item title to 25 chars', async () => {
      getPluginLinkExtensionsMock.mockReturnValue({
        extensions: [
          {
            id: '1',
            pluginId: '...',
            type: PluginExtensionTypes.link,
            title: 'Declare incident when pressing this amazing menu item',
            description: 'Declaring an incident in the app',
            path: '/a/grafana-basic-app/declare-incident',
          },
        ],
      });

      const { menu, panel } = await buildTestScene({});

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.length).toBe(7);

      const extensionsSubMenu = menu.state.items?.find((i) => i.text === 'Extensions')?.subMenu;

      expect(extensionsSubMenu).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Declare incident when...',
            href: '/a/grafana-basic-app/declare-incident',
          }),
        ])
      );
    });

    it('should pass onClick from plugin extension link to menu item', async () => {
      const expectedOnClick = jest.fn();

      getPluginLinkExtensionsMock.mockReturnValue({
        extensions: [
          {
            id: '1',
            pluginId: '...',
            type: PluginExtensionTypes.link,
            title: 'Declare incident when pressing this amazing menu item',
            description: 'Declaring an incident in the app',
            onClick: expectedOnClick,
          },
        ],
      });

      const { menu, panel } = await buildTestScene({});

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.length).toBe(7);

      const extensionsSubMenu = menu.state.items?.find((i) => i.text === 'Extensions')?.subMenu;
      const menuItem = extensionsSubMenu?.find((i) => (i.text = 'Declare incident when...'));

      menuItem?.onClick?.({} as React.MouseEvent);
      expect(expectedOnClick).toBeCalledTimes(1);
    });

    it('should pass context with correct values when configuring extension', async () => {
      const data: PanelData = {
        series: [
          toDataFrame({
            fields: [
              { name: 'time', type: FieldType.time },
              { name: 'score', type: FieldType.number },
            ],
          }),
        ],
        timeRange: getDefaultTimeRange(),
        state: LoadingState.Done,
      };

      const { menu, panel } = await buildTestScene({});

      panel.state.$data?.setState({ data });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      const context: PluginExtensionPanelContext = {
        id: 12,
        pluginId: 'table',
        title: 'Panel A',
        timeZone: 'Africa/Abidjan',
        timeRange: {
          from: 'now-5m',
          to: 'now',
        },
        targets: [
          {
            refId: 'A',
            // @ts-expect-error
            query: 'QueryA',
          },
        ],
        dashboard: {
          tags: ['database', 'panel'],
          uid: 'dash-1',
          title: 'My dashboard',
        },
        scopedVars: {
          a: {
            text: 'a',
            value: 'a',
          },
        },
        data,
      };

      expect(getPluginLinkExtensionsMock).toBeCalledWith(expect.objectContaining({ context }));
    });

    it('should pass context with default time zone values when configuring extension', async () => {
      const data: PanelData = {
        series: [
          toDataFrame({
            fields: [
              { name: 'time', type: FieldType.time },
              { name: 'score', type: FieldType.number },
            ],
          }),
        ],
        timeRange: getDefaultTimeRange(),
        state: LoadingState.Done,
      };

      const { menu, panel, scene } = await buildTestScene({});

      panel.state.$data?.setState({ data });
      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });
      scene.state.$timeRange?.setState({ timeZone: undefined });

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      const context: PluginExtensionPanelContext = {
        id: 12,
        pluginId: 'table',
        title: 'Panel A',
        timeZone: 'browser',
        timeRange: {
          from: 'now-5m',
          to: 'now',
        },
        targets: [
          {
            refId: 'A',
            // @ts-expect-error
            query: 'QueryA',
          },
        ],
        dashboard: {
          tags: ['database', 'panel'],
          uid: 'dash-1',
          title: 'My dashboard',
        },
        scopedVars: {
          a: {
            text: 'a',
            value: 'a',
          },
        },
        data,
      };

      expect(getPluginLinkExtensionsMock).toBeCalledWith(expect.objectContaining({ context }));
    });

    it('should contain menu item with category', async () => {
      getPluginLinkExtensionsMock.mockReturnValue({
        extensions: [
          {
            id: '1',
            pluginId: '...',
            type: PluginExtensionTypes.link,
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: '/a/grafana-basic-app/declare-incident',
            category: 'Incident',
          },
        ],
      });

      const { menu, panel } = await buildTestScene({});

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.length).toBe(7);

      const extensionsSubMenu = menu.state.items?.find((i) => i.text === 'Extensions')?.subMenu;

      expect(extensionsSubMenu).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Incident',
            subMenu: expect.arrayContaining([
              expect.objectContaining({
                text: 'Declare incident',
                href: '/a/grafana-basic-app/declare-incident',
              }),
            ]),
          }),
        ])
      );
    });

    it('should truncate category to 25 chars', async () => {
      getPluginLinkExtensionsMock.mockReturnValue({
        extensions: [
          {
            id: '1',
            pluginId: '...',
            type: PluginExtensionTypes.link,
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: '/a/grafana-basic-app/declare-incident',
            category: 'Declare incident when pressing this amazing menu item',
          },
        ],
      });

      const { menu, panel } = await buildTestScene({});

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.length).toBe(7);

      const extensionsSubMenu = menu.state.items?.find((i) => i.text === 'Extensions')?.subMenu;

      expect(extensionsSubMenu).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Declare incident when...',
            subMenu: expect.arrayContaining([
              expect.objectContaining({
                text: 'Declare incident',
                href: '/a/grafana-basic-app/declare-incident',
              }),
            ]),
          }),
        ])
      );
    });

    it('should contain menu item with category and append items without category after divider', async () => {
      getPluginLinkExtensionsMock.mockReturnValue({
        extensions: [
          {
            id: '1',
            pluginId: '...',
            type: PluginExtensionTypes.link,
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: '/a/grafana-basic-app/declare-incident',
            category: 'Incident',
          },
          {
            id: '2',
            pluginId: '...',
            type: PluginExtensionTypes.link,
            title: 'Create forecast',
            description: 'Declaring an incident in the app',
            path: '/a/grafana-basic-app/declare-incident',
          },
        ],
      });

      const { menu, panel } = await buildTestScene({});

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.length).toBe(7);

      const extensionsSubMenu = menu.state.items?.find((i) => i.text === 'Extensions')?.subMenu;

      expect(extensionsSubMenu).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Incident',
            subMenu: expect.arrayContaining([
              expect.objectContaining({
                text: 'Declare incident',
                href: '/a/grafana-basic-app/declare-incident',
              }),
            ]),
          }),
          expect.objectContaining({
            type: 'divider',
          }),
          expect.objectContaining({
            text: 'Create forecast',
          }),
        ])
      );
    });

    it('it should not contain remove and duplicate menu items when not in edit mode', async () => {
      const { menu, panel } = await buildTestScene({});

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.find((i) => i.text === 'Remove')).toBeUndefined();
      const moreMenu = menu.state.items?.find((i) => i.text === 'More...')?.subMenu;
      expect(moreMenu?.find((i) => i.text === 'Duplicate')).toBeUndefined();
      expect(moreMenu?.find((i) => i.text === 'Create library panel')).toBeUndefined();
    });

    it('it should contain remove and duplicate menu items when in edit mode', async () => {
      const { scene, menu, panel } = await buildTestScene({});
      scene.setState({ isEditing: true });

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.find((i) => i.text === 'Remove')).toBeDefined();
      const moreMenu = menu.state.items?.find((i) => i.text === 'More...')?.subMenu;
      expect(moreMenu?.find((i) => i.text === 'Duplicate')).toBeDefined();
      expect(moreMenu?.find((i) => i.text === 'Create library panel')).toBeDefined();
    });

    it('should only contain explore when embedded', async () => {
      const { menu, panel } = await buildTestScene({ isEmbedded: true });

      panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

      mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
      mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

      menu.activate();

      await new Promise((r) => setTimeout(r, 1));

      expect(menu.state.items?.length).toBe(1);
      expect(menu.state.items?.[0].text).toBe('Explore');
    });
  });
});

interface SceneOptions {
  isEmbedded?: boolean;
}

async function buildTestScene(options: SceneOptions) {
  const menu = new VizPanelMenu({
    $behaviors: [panelMenuBehavior],
  });

  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
    menu,
    titleItems: [new VizPanelLinks({ menu: new VizPanelLinksMenu({}) })],
    $variables: new SceneVariableSet({
      variables: [new LocalValueVariable({ name: 'a', value: 'a', text: 'a' })],
    }),
    $data: new SceneQueryRunner({
      datasource: { uid: 'my-uid' },
      queries: [{ query: 'QueryA', refId: 'A' }],
    }),
  });

  const scene = new DashboardScene({
    title: 'My dashboard',
    uid: 'dash-1',
    tags: ['database', 'panel'],
    $timeRange: new SceneTimeRange({
      from: 'now-5m',
      to: 'now',
      timeZone: 'Africa/Abidjan',
    }),
    meta: {
      canEdit: true,
      isEmbedded: options.isEmbedded ?? false,
    },
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
