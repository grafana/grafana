import { PanelMenuItem } from '@grafana/data';
import config from 'app/core/config';
import * as actions from 'app/features/explore/state/main';
import { setStore } from 'app/store/store';

import { PanelModel } from '../state';
import { createDashboardModelFixture } from '../state/__fixtures__/dashboardFixtures';

import { getPanelMenu } from './getPanelMenu';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasAccessToExplore: () => true,
  },
}));

describe('getPanelMenu', () => {
  it('should return the correct panel menu items', () => {
    const panel = new PanelModel({});
    const dashboard = createDashboardModelFixture({});

    const menuItems = getPanelMenu(dashboard, panel);
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
          "shortcut": "x",
          "text": "Explore",
        },
        {
          "iconClassName": "info-circle",
          "onClick": [Function],
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
          "onClick": [Function],
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

  describe('when panel is in view mode', () => {
    it('should return the correct panel menu items', () => {
      const getExtendedMenu = () => [{ text: 'Toggle legend', shortcut: 'p l', click: jest.fn() }];
      const ctrl: any = { getExtendedMenu };
      const scope: any = { $$childHead: { ctrl } };
      const angularComponent: any = { getScope: () => scope };
      const panel = new PanelModel({ isViewing: true });
      const dashboard = createDashboardModelFixture({});

      const menuItems = getPanelMenu(dashboard, panel, angularComponent);
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
            "shortcut": "x",
            "text": "Explore",
          },
          {
            "iconClassName": "info-circle",
            "onClick": [Function],
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
            "onClick": [Function],
            "subMenu": [
              {
                "href": undefined,
                "onClick": [Function],
                "shortcut": "p l",
                "text": "Toggle legend",
              },
            ],
            "text": "More...",
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
    let navigateSpy: any;

    beforeAll(() => {
      const panel = new PanelModel({});
      const dashboard = createDashboardModelFixture({});
      const menuItems = getPanelMenu(dashboard, panel);
      explore = menuItems.find((item) => item.text === 'Explore') as PanelMenuItem;
      navigateSpy = jest.spyOn(actions, 'navigateToExplore');
      window.open = windowOpen;

      event = {
        ctrlKey: true,
        preventDefault: jest.fn(),
      };

      setStore({ dispatch: jest.fn() } as any);
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
});
