import { PanelModel, DashboardModel } from '../state';
import { getPanelMenu } from './getPanelMenu';

describe('getPanelMenu', () => {
  it('should return the correct panel menu items', () => {
    const panel = new PanelModel({});
    const dashboard = new DashboardModel({});

    const menuItems = getPanelMenu(dashboard, panel);
    expect(menuItems).toMatchInlineSnapshot(`
      Array [
        Object {
          "iconClassName": "gicon gicon-viewer",
          "onClick": [Function],
          "shortcut": "v",
          "text": "View",
        },
        Object {
          "iconClassName": "gicon gicon-editor",
          "onClick": [Function],
          "shortcut": "e",
          "text": "Edit",
        },
        Object {
          "iconClassName": "fa fa-fw fa-share",
          "onClick": [Function],
          "shortcut": "p s",
          "text": "Share",
        },
        Object {
          "iconClassName": "fa fa-fw fa-cube",
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
            Object {
              "onClick": [Function],
              "text": "Panel JSON",
            },
          ],
          "text": "More...",
          "type": "submenu",
        },
        Object {
          "type": "divider",
        },
        Object {
          "iconClassName": "fa fa-fw fa-trash",
          "onClick": [Function],
          "shortcut": "p r",
          "text": "Remove",
        },
      ]
    `);
  });
});
