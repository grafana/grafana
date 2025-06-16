import {
  FieldType,
  LoadingState,
  PanelData,
  PluginExtensionPanelContext,
  PluginExtensionTypes,
  getDefaultTimeRange,
  toDataFrame,
  urlUtil,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { config, locationService } from '@grafana/runtime';
import {
  LocalValueVariable,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';
import { GetExploreUrlArguments } from 'app/core/utils/explore';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { scenesPanelToRuleFormValues } from 'app/features/alerting/unified/utils/rule-form';
import * as storeModule from 'app/store/store';
import { AccessControlAction } from 'app/types';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';

import { DashboardScene } from './DashboardScene';
import { VizPanelLinks, VizPanelLinksMenu } from './PanelLinks';
import { panelMenuBehavior } from './PanelMenuBehavior';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

const mocks = {
  contextSrv: jest.mocked(contextSrv),
  getExploreUrl: jest.fn(),
  notifyApp: jest.fn(),
};

jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  getExploreUrl: (options: GetExploreUrlArguments) => {
    return mocks.getExploreUrl(options);
  },
}));

jest.mock('app/core/services/context_srv');

jest.mock('app/store/store', () => ({
  dispatch: jest.fn(),
}));

const getPluginExtensionsMock = jest.fn().mockReturnValue({ extensions: [] });
jest.mock('app/features/plugins/extensions/getPluginExtensions', () => ({
  ...jest.requireActual('app/features/plugins/extensions/getPluginExtensions'),
  createPluginExtensionsGetter: () => getPluginExtensionsMock,
}));

describe('panelMenuBehavior', () => {
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

  it('should have reduced menu options when panel editor is open', async () => {
    const { scene, menu, panel } = await buildTestScene({});
    scene.setState({ editPanel: buildPanelEditScene(panel) });
    panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

    mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
    mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

    config.unifiedAlertingEnabled = true;
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleUpdate]);

    menu.activate();

    await new Promise((r) => setTimeout(r, 1));

    expect(menu.state.items?.length).toBe(4);
    expect(menu.state.items?.[0].text).toBe('Share');
    expect(menu.state.items?.[1].text).toBe('Explore');
    expect(menu.state.items?.[2].text).toBe('Inspect');
    expect(menu.state.items?.[3].text).toBe('More...');
    expect(menu.state.items?.[3].subMenu).toBeDefined();

    expect(menu.state.items?.[3].subMenu?.length).toBe(2);
    expect(menu.state.items?.[3].subMenu?.[0].text).toBe('New alert rule');
    expect(menu.state.items?.[3].subMenu?.[1].text).toBe('Get help');
  });

  describe('when extending panel menu from plugins', () => {
    it('should contain menu item from link extension', async () => {
      getPluginExtensionsMock.mockReturnValue({
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
      getPluginExtensionsMock.mockReturnValue({
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

      getPluginExtensionsMock.mockReturnValue({
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

      expect(getPluginExtensionsMock).toBeCalledWith(expect.objectContaining({ context }));
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

      expect(getPluginExtensionsMock).toBeCalledWith(expect.objectContaining({ context }));
    });

    it('should contain menu item with category', async () => {
      getPluginExtensionsMock.mockReturnValue({
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
      getPluginExtensionsMock.mockReturnValue({
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
      getPluginExtensionsMock.mockReturnValue({
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

    describe('plugin links', () => {
      it('should not show Metrics Drilldown menu when no Metrics Drilldown links exist', async () => {
        getPluginExtensionsMock.mockReturnValue({
          extensions: [
            {
              id: '1',
              pluginId: '...',
              type: PluginExtensionTypes.link,
              title: 'Other Extension',
              description: 'Some other extension',
              path: '/a/other-app/action',
            },
          ],
        });

        const { menu, panel } = await buildTestScene({});

        panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

        mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
        mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

        menu.activate();

        await new Promise((r) => setTimeout(r, 1));

        const metricsDrilldownMenu = menu.state.items?.find((i) => i.text === 'Metrics drilldown');
        const extensionsMenu = menu.state.items?.find((i) => i.text === 'Extensions');

        expect(metricsDrilldownMenu).toBeUndefined();
        expect(extensionsMenu).toBeDefined();
        expect(extensionsMenu?.subMenu).toEqual([
          expect.objectContaining({
            text: 'Other Extension',
            href: '/a/other-app/action',
          }),
        ]);
      });

      it('should separate Metrics Drilldown links into their own menu', async () => {
        getPluginExtensionsMock.mockReturnValue({
          extensions: [
            {
              id: '1',
              pluginId: '...',
              type: PluginExtensionTypes.link,
              title: 'Open in Metrics Drilldown',
              description: 'Open current query in Metrics Drilldown',
              path: '/a/grafana-metricsdrilldown-app/trail',
              category: 'metrics-drilldown',
            },
            {
              id: '2',
              pluginId: '...',
              type: PluginExtensionTypes.link,
              title: 'Other Extension',
              description: 'Some other extension',
              path: '/a/other-app/action',
            },
          ],
        });

        const { menu, panel } = await buildTestScene({});

        panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

        mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
        mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

        menu.activate();

        await new Promise((r) => setTimeout(r, 1));

        expect(menu.state.items?.length).toBe(8); // 6 base items + 2 extension menus

        const metricsDrilldownMenu = menu.state.items?.find((i) => i.text === 'Metrics drilldown');
        const extensionsMenu = menu.state.items?.find((i) => i.text === 'Extensions');

        expect(metricsDrilldownMenu).toBeDefined();
        expect(metricsDrilldownMenu?.iconClassName).toBe('code-branch');
        expect(metricsDrilldownMenu?.subMenu).toEqual([
          expect.objectContaining({
            text: 'metrics-drilldown',
            type: 'group',
            subMenu: expect.arrayContaining([
              expect.objectContaining({
                text: 'Open in Metrics Drilld...',
                href: '/a/grafana-metricsdrilldown-app/trail',
              }),
            ]),
          }),
        ]);

        expect(extensionsMenu).toBeDefined();
        expect(extensionsMenu?.iconClassName).toBe('plug');
        expect(extensionsMenu?.subMenu).toEqual([
          expect.objectContaining({
            text: 'Other Extension',
            href: '/a/other-app/action',
          }),
        ]);
      });

      it('should not show extensions menu when no non-Metrics Drilldown links exist', async () => {
        getPluginExtensionsMock.mockReturnValue({
          extensions: [
            {
              id: '1',
              pluginId: '...',
              type: PluginExtensionTypes.link,
              title: 'Open in Metrics Drilldown',
              description: 'Open current query in Metrics Drilldown',
              path: '/a/grafana-metricsdrilldown-app/trail',
              category: 'metrics-drilldown',
            },
          ],
        });

        const { menu, panel } = await buildTestScene({});

        panel.getPlugin = () => getPanelPlugin({ skipDataQuery: false });

        mocks.contextSrv.hasAccessToExplore.mockReturnValue(true);
        mocks.getExploreUrl.mockReturnValue(Promise.resolve('/explore'));

        menu.activate();

        await new Promise((r) => setTimeout(r, 1));

        const metricsDrilldownMenu = menu.state.items?.find((i) => i.text === 'Metrics drilldown');
        const extensionsMenu = menu.state.items?.find((i) => i.text === 'Extensions');

        expect(metricsDrilldownMenu).toBeDefined();
        expect(extensionsMenu).toBeUndefined();
        expect(metricsDrilldownMenu?.subMenu).toEqual([
          expect.objectContaining({
            text: 'metrics-drilldown',
            type: 'group',
            subMenu: expect.arrayContaining([
              expect.objectContaining({
                text: 'Open in Metrics Drilld...',
                href: '/a/grafana-metricsdrilldown-app/trail',
              }),
            ]),
          }),
        ]);
      });
    });
  });

  describe('onCreateAlert', () => {
    beforeEach(() => {
      jest.spyOn(storeModule, 'dispatch').mockImplementation(() => {});
      jest.spyOn(locationService, 'push').mockImplementation(() => {});
      jest.spyOn(urlUtil, 'renderUrl').mockImplementation((url, params) => `${url}?${JSON.stringify(params)}`);
    });

    it('should navigate to alert creation page on success', async () => {
      const { menu, panel } = await buildTestScene({});
      const mockFormValues = { someKey: 'someValue' };

      config.unifiedAlertingEnabled = true;
      grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleUpdate]);

      jest
        .spyOn(require('app/features/alerting/unified/utils/rule-form'), 'scenesPanelToRuleFormValues')
        .mockResolvedValue(mockFormValues);

      // activate the menu
      menu.activate();
      // wait for the menu to be activated
      await new Promise((r) => setTimeout(r, 1));
      // use userEvent mechanism to click the menu item
      const moreMenu = menu.state.items?.find((i) => i.text === 'More...')?.subMenu;
      const alertMenuItem = moreMenu?.find((i) => i.text === 'New alert rule')?.onClick;
      expect(alertMenuItem).toBeDefined();

      alertMenuItem?.({} as React.MouseEvent);
      expect(scenesPanelToRuleFormValues).toHaveBeenCalledWith(panel);
    });

    it('should show error notification on failure', async () => {
      const { menu, panel } = await buildTestScene({});
      const mockError = new Error('Test error');
      jest
        .spyOn(require('app/features/alerting/unified/utils/rule-form'), 'scenesPanelToRuleFormValues')
        .mockRejectedValue(mockError);
      // Don't make notifyApp throw an error, just mock it

      menu.activate();
      await new Promise((r) => setTimeout(r, 1));

      const moreMenu = menu.state.items?.find((i) => i.text === 'More...')?.subMenu;
      const alertMenuItem = moreMenu?.find((i) => i.text === 'New alert rule')?.onClick;
      expect(alertMenuItem).toBeDefined();

      await alertMenuItem?.({} as React.MouseEvent);

      await new Promise((r) => setTimeout(r, 0));

      expect(scenesPanelToRuleFormValues).toHaveBeenCalledWith(panel);
    });

    it('should render "New alert rule" menu item when user has permissions to read and update alerts', async () => {
      const { menu } = await buildTestScene({});
      config.unifiedAlertingEnabled = true;
      grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleUpdate]);

      menu.activate();
      await new Promise((r) => setTimeout(r, 1));

      const moreMenu = menu.state.items?.find((i) => i.text === 'More...')?.subMenu;
      expect(moreMenu?.find((i) => i.text === 'New alert rule')).toBeDefined();
    });

    it('should not contain "New alert rule" menu item when user does not have permissions to read and update alerts', async () => {
      const { menu } = await buildTestScene({});
      config.unifiedAlertingEnabled = true;
      grantUserPermissions([AccessControlAction.AlertingRuleRead]);

      menu.activate();
      await new Promise((r) => setTimeout(r, 1));

      const moreMenu = menu.state.items?.find((i) => i.text === 'More...')?.subMenu;
      expect(moreMenu?.find((i) => i.text === 'New alert rule')).toBeUndefined();
    });

    it('should not contain "New alert rule" menu item when unifiedAlertingEnabled is false', async () => {
      const { menu } = await buildTestScene({});
      config.unifiedAlertingEnabled = false;

      menu.activate();
      await new Promise((r) => setTimeout(r, 1));

      const moreMenu = menu.state.items?.find((i) => i.text === 'More...')?.subMenu;
      expect(moreMenu?.find((i) => i.text === 'New alert rule')).toBeUndefined();
    });

    it('should not contain "New alert rule" menu item when user does not have permissions to read and update alerts', async () => {
      const { menu } = await buildTestScene({});
      config.unifiedAlertingEnabled = true;
      grantUserPermissions([AccessControlAction.AlertingRuleRead]);

      menu.activate();
      await new Promise((r) => setTimeout(r, 1));

      const moreMenu = menu.state.items?.find((i) => i.text === 'More...')?.subMenu;
      const alertMenuItem = moreMenu?.find((i) => i.text === 'New alert rule')?.onClick;
      expect(alertMenuItem).toBeUndefined();
    });

    afterEach(() => {
      jest.restoreAllMocks();
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
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });

  await new Promise((r) => setTimeout(r, 1));

  return { scene, panel, menu };
}
