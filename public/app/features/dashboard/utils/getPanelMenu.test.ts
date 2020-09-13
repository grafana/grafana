import { DashboardModel, PanelModel } from '../state';
import { getPanelMenu } from './getPanelMenu';
import { describe } from '../../../../test/lib/common';

describe('getPanelMenu', () => {
  it('should return the correct panel menu items', () => {
    const panel = new PanelModel({});
    const dashboard = new DashboardModel({});

    const menuItems = getPanelMenu(dashboard, panel);
    expect(menuItems).toMatchInlineSnapshot(`
      Array [
        Object {
          "iconClassName": "eye",
          "onClick": [Function],
          "shortcut": "v",
          "text": "View",
        },
        Object {
          "iconClassName": "edit",
          "onClick": [Function],
          "shortcut": "e",
          "text": "Edit",
        },
        Object {
          "iconClassName": "share-alt",
          "onClick": [Function],
          "shortcut": "p s",
          "text": "Share",
        },
        Object {
          "iconClassName": "info-circle",
          "onClick": [Function],
          "shortcut": "i",
          "subMenu": Array [
            Object {
              "onClick": [Function],
              "text": "Panel JSON",
            },
          ],
          "text": "Inspect",
          "type": "submenu",
        },
        Object {
          "iconClassName": "cube",
          "onClick": [Function],
          "subMenu": Array [
            Object {
              "onClick": [Function],
              "shortcut": "p d",
              "text": "Duplicate",
            },
            Object {
              "onClick": [Function],
              "text": "Copy",
            },
          ],
          "text": "More...",
          "type": "submenu",
        },
        Object {
          "text": "",
          "type": "divider",
        },
        Object {
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
      const dashboard = new DashboardModel({});

      const menuItems = getPanelMenu(dashboard, panel, angularComponent);
      expect(menuItems).toMatchInlineSnapshot(`
        Array [
          Object {
            "iconClassName": "eye",
            "onClick": [Function],
            "shortcut": "v",
            "text": "View",
          },
          Object {
            "iconClassName": "edit",
            "onClick": [Function],
            "shortcut": "e",
            "text": "Edit",
          },
          Object {
            "iconClassName": "share-alt",
            "onClick": [Function],
            "shortcut": "p s",
            "text": "Share",
          },
          Object {
            "iconClassName": "info-circle",
            "onClick": [Function],
            "shortcut": "i",
            "subMenu": Array [
              Object {
                "onClick": [Function],
                "text": "Panel JSON",
              },
            ],
            "text": "Inspect",
            "type": "submenu",
          },
          Object {
            "iconClassName": "cube",
            "onClick": [Function],
            "subMenu": Array [
              Object {
                "href": undefined,
                "onClick": [Function],
                "shortcut": "p l",
                "text": "Toggle legend",
              },
            ],
            "text": "More...",
            "type": "submenu",
          },
          Object {
            "text": "",
            "type": "divider",
          },
          Object {
            "iconClassName": "trash-alt",
            "onClick": [Function],
            "shortcut": "p r",
            "text": "Remove",
          },
        ]
      `);
    });
  });
});
