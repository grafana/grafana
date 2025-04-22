import { Store } from 'redux';

import { PanelMenuItem, PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import config from 'app/core/config';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import * as actions from 'app/features/explore/state/main';
import { setStore } from 'app/store/store';
import { AccessControlAction } from 'app/types';

import { PanelModel } from '../state/PanelModel';
import { createDashboardModelFixture } from '../state/__fixtures__/dashboardFixtures';

import { getPanelMenu } from './getPanelMenu';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasAccessToExplore: () => true,
    hasPermission: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginLinksHook: jest.fn(),
  usePluginLinks: jest.fn(),
}));

const usePluginLinksMock = jest.mocked(usePluginLinks);

describe('getPanelMenu()', () => {
  beforeEach(() => {
    usePluginLinksMock.mockRestore();
    usePluginLinksMock.mockReturnValue({ links: [], isLoading: false });
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleUpdate]);
    config.unifiedAlertingEnabled = false;
  });

  it('should return the correct panel menu items', () => {
    const panel = new PanelModel({});
    const dashboard = createDashboardModelFixture({});
    const extensions: PluginExtensionLink[] = [];

    const menuItems = getPanelMenu(dashboard, panel, extensions);
    expect(menuItems).toMatchInlineSnapshot(`
      [
        {
          "iconClassName": "eye",
          "onClick": [Function],
          "shortcut": "v",
          "text": "View",
        },
        {
          "iconClassName": "edit",
          "onClick": [Function],
          "shortcut": "e",
          "text": "Edit",
        },
        {
          "iconClassName": "share-alt",
          "onClick": [Function],
          "shortcut": "p s",
          "text": "Share",
        },
        {
          "iconClassName": "compass",
          "onClick": [Function],
          "shortcut": "p x",
          "text": "Explore",
        },
        {
          "iconClassName": "info-circle",
          "shortcut": "i",
          "subMenu": [
            {
              "onClick": [Function],
              "text": "Panel JSON",
            },
          ],
          "text": "Inspect",
          "type": "submenu",
        },
        {
          "iconClassName": "cube",
          "subMenu": [
            {
              "onClick": [Function],
              "shortcut": "p d",
              "text": "Duplicate",
            },
            {
              "onClick": [Function],
              "text": "Copy",
            },
            {
              "onClick": [Function],
              "text": "Create library panel",
            },
          ],
          "text": "More...",
          "type": "submenu",
        },
        {
          "text": "",
          "type": "divider",
        },
        {
          "iconClassName": "trash-alt",
          "onClick": [Function],
          "shortcut": "p r",
          "text": "Remove",
        },
      ]
    `);
  });

  describe('when extending panel menu from plugins', () => {
    it('should contain menu item from link extension', () => {
      const extensions: PluginExtensionLink[] = [
        {
          id: '1',
          pluginId: '...',
          type: PluginExtensionTypes.link,
          title: 'Declare incident',
          description: 'Declaring an incident in the app',
          path: '/a/grafana-basic-app/declare-incident',
        },
      ];

      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const menuItems = getPanelMenu(dashboard, panel, extensions);
      const extensionsSubMenu = menuItems.find((i) => i.text === 'Extensions')?.subMenu;

      expect(extensionsSubMenu).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Declare incident',
            href: '/a/grafana-basic-app/declare-incident',
          }),
        ])
      );
    });

    it('should truncate menu item title to 25 chars', () => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [
        {
          id: '1',
          pluginId: '...',
          type: PluginExtensionTypes.link,
          title: 'Declare incident when pressing this amazing menu item',
          description: 'Declaring an incident in the app',
          path: '/a/grafana-basic-app/declare-incident',
        },
      ];
      const menuItems = getPanelMenu(dashboard, panel, extensions);
      const extensionsSubMenu = menuItems.find((i) => i.text === 'Extensions')?.subMenu;

      expect(extensionsSubMenu).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'Declare incident when...',
            href: '/a/grafana-basic-app/declare-incident',
          }),
        ])
      );
    });

    it('should pass onClick from plugin extension link to menu item', () => {
      const expectedOnClick = jest.fn();
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [
        {
          id: '1',
          pluginId: '...',
          type: PluginExtensionTypes.link,
          title: 'Declare incident when pressing this amazing menu item',
          description: 'Declaring an incident in the app',
          onClick: expectedOnClick,
        },
      ];

      const menuItems = getPanelMenu(dashboard, panel, extensions);
      const extensionsSubMenu = menuItems.find((i) => i.text === 'Extensions')?.subMenu;
      const menuItem = extensionsSubMenu?.find((i) => (i.text = 'Declare incident when...'));

      menuItem?.onClick?.({} as React.MouseEvent);
      expect(expectedOnClick).toHaveBeenCalledTimes(1);
    });

    it('should contain menu item with category', () => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [
        {
          id: '1',
          pluginId: '...',
          type: PluginExtensionTypes.link,
          title: 'Declare incident',
          description: 'Declaring an incident in the app',
          path: '/a/grafana-basic-app/declare-incident',
          category: 'Incident',
        },
      ];
      const menuItems = getPanelMenu(dashboard, panel, extensions);
      const extensionsSubMenu = menuItems.find((i) => i.text === 'Extensions')?.subMenu;

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

    it('should truncate category to 25 chars', () => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [
        {
          id: '1',
          pluginId: '...',
          type: PluginExtensionTypes.link,
          title: 'Declare incident',
          description: 'Declaring an incident in the app',
          path: '/a/grafana-basic-app/declare-incident',
          category: 'Declare incident when pressing this amazing menu item',
        },
      ];
      const menuItems = getPanelMenu(dashboard, panel, extensions);
      const extensionsSubMenu = menuItems.find((i) => i.text === 'Extensions')?.subMenu;

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

    it('should contain menu item with category and append items without category after divider', () => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [
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
      ];
      const menuItems = getPanelMenu(dashboard, panel, extensions);
      const extensionsSubMenu = menuItems.find((i) => i.text === 'Extensions')?.subMenu;

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
  });

  describe('when panel is in view mode', () => {
    it('should return the correct panel menu items', () => {
      const panel = new PanelModel({ isViewing: true });
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [];

      const menuItems = getPanelMenu(dashboard, panel, extensions);
      expect(menuItems).toMatchInlineSnapshot(`
        [
          {
            "iconClassName": "eye",
            "onClick": [Function],
            "shortcut": "v",
            "text": "View",
          },
          {
            "iconClassName": "edit",
            "onClick": [Function],
            "shortcut": "e",
            "text": "Edit",
          },
          {
            "iconClassName": "share-alt",
            "onClick": [Function],
            "shortcut": "p s",
            "text": "Share",
          },
          {
            "iconClassName": "compass",
            "onClick": [Function],
            "shortcut": "p x",
            "text": "Explore",
          },
          {
            "iconClassName": "info-circle",
            "shortcut": "i",
            "subMenu": [
              {
                "onClick": [Function],
                "text": "Panel JSON",
              },
            ],
            "text": "Inspect",
            "type": "submenu",
          },
        ]
      `);
    });
  });

  describe('onNavigateToExplore', () => {
    const testSubUrl = '/testSubUrl';
    const testUrl = '/testUrl';
    const windowOpen = jest.fn();
    let event: any;
    let explore: PanelMenuItem;
    let navigateSpy: jest.SpyInstance;

    beforeAll(() => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [];
      const menuItems = getPanelMenu(dashboard, panel, extensions);
      explore = menuItems.find((item) => item.text === 'Explore') as PanelMenuItem;
      navigateSpy = jest.spyOn(actions, 'navigateToExplore');
      window.open = windowOpen;

      event = {
        ctrlKey: true,
        preventDefault: jest.fn(),
      };

      setStore({ dispatch: jest.fn() } as unknown as Store);
    });

    it('should navigate to url without subUrl', () => {
      explore.onClick!(event);

      const openInNewWindow = navigateSpy.mock.calls[0][1].openInNewWindow;

      openInNewWindow(testUrl);

      expect(windowOpen).toHaveBeenLastCalledWith(testUrl);
    });

    it('should navigate to url with subUrl', () => {
      config.appSubUrl = testSubUrl;
      explore.onClick!(event);

      const openInNewWindow = navigateSpy.mock.calls[0][1].openInNewWindow;

      openInNewWindow(testUrl);

      expect(windowOpen).toHaveBeenLastCalledWith(`${testSubUrl}${testUrl}`);
    });
  });

  describe('Alerting menu', () => {
    it('should render "New alert rule" menu item if user has permissions to read and update alerts ', () => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [];

      config.unifiedAlertingEnabled = true;
      grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleUpdate]);
      const menuItems = getPanelMenu(dashboard, panel, extensions);
      const moreSubMenu = menuItems.find((i) => i.text === 'More...')?.subMenu;

      expect(moreSubMenu).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'New alert rule',
          }),
        ])
      );
    });

    it('should not render "New alert rule" menu item, if user does not have permissions to update alerts ', () => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [];

      grantUserPermissions([AccessControlAction.AlertingRuleRead]);
      config.unifiedAlertingEnabled = true;

      const menuItems = getPanelMenu(dashboard, panel, extensions);

      const moreSubMenu = menuItems.find((i) => i.text === 'More...')?.subMenu;

      expect(moreSubMenu).toEqual(
        expect.arrayContaining([
          expect.not.objectContaining({
            text: 'New alert rule',
          }),
        ])
      );
    });

    it('should not render "New alert rule" menu item, if user does not have permissions to read update alerts ', () => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const extensions: PluginExtensionLink[] = [];

      grantUserPermissions([]);
      config.unifiedAlertingEnabled = true;

      const menuItems = getPanelMenu(dashboard, panel, extensions);

      const moreSubMenu = menuItems.find((i) => i.text === 'More...')?.subMenu;
      const createAlertOption = moreSubMenu?.find((i) => i.text === 'New alert rule')?.subMenu;

      expect(createAlertOption).toBeUndefined();
    });
  });
});
