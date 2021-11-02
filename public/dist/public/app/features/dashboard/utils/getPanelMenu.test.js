import { DashboardModel, PanelModel } from '../state';
import { getPanelMenu } from './getPanelMenu';
import { describe } from '../../../../test/lib/common';
import { setStore } from 'app/store/store';
import config from 'app/core/config';
import * as actions from 'app/features/explore/state/main';
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        hasAccessToExplore: function () { return true; },
    },
}); });
describe('getPanelMenu', function () {
    it('should return the correct panel menu items', function () {
        var panel = new PanelModel({});
        var dashboard = new DashboardModel({});
        var menuItems = getPanelMenu(dashboard, panel);
        expect(menuItems).toMatchInlineSnapshot("\n      Array [\n        Object {\n          \"iconClassName\": \"eye\",\n          \"onClick\": [Function],\n          \"shortcut\": \"v\",\n          \"text\": \"View\",\n        },\n        Object {\n          \"iconClassName\": \"edit\",\n          \"onClick\": [Function],\n          \"shortcut\": \"e\",\n          \"text\": \"Edit\",\n        },\n        Object {\n          \"iconClassName\": \"share-alt\",\n          \"onClick\": [Function],\n          \"shortcut\": \"p s\",\n          \"text\": \"Share\",\n        },\n        Object {\n          \"iconClassName\": \"compass\",\n          \"onClick\": [Function],\n          \"shortcut\": \"x\",\n          \"text\": \"Explore\",\n        },\n        Object {\n          \"iconClassName\": \"info-circle\",\n          \"onClick\": [Function],\n          \"shortcut\": \"i\",\n          \"subMenu\": Array [\n            Object {\n              \"onClick\": [Function],\n              \"text\": \"Panel JSON\",\n            },\n          ],\n          \"text\": \"Inspect\",\n          \"type\": \"submenu\",\n        },\n        Object {\n          \"iconClassName\": \"cube\",\n          \"onClick\": [Function],\n          \"subMenu\": Array [\n            Object {\n              \"onClick\": [Function],\n              \"shortcut\": \"p d\",\n              \"text\": \"Duplicate\",\n            },\n            Object {\n              \"onClick\": [Function],\n              \"text\": \"Copy\",\n            },\n            Object {\n              \"onClick\": [Function],\n              \"text\": \"Create library panel\",\n            },\n          ],\n          \"text\": \"More...\",\n          \"type\": \"submenu\",\n        },\n        Object {\n          \"text\": \"\",\n          \"type\": \"divider\",\n        },\n        Object {\n          \"iconClassName\": \"trash-alt\",\n          \"onClick\": [Function],\n          \"shortcut\": \"p r\",\n          \"text\": \"Remove\",\n        },\n      ]\n    ");
    });
    describe('when panel is in view mode', function () {
        it('should return the correct panel menu items', function () {
            var getExtendedMenu = function () { return [{ text: 'Toggle legend', shortcut: 'p l', click: jest.fn() }]; };
            var ctrl = { getExtendedMenu: getExtendedMenu };
            var scope = { $$childHead: { ctrl: ctrl } };
            var angularComponent = { getScope: function () { return scope; } };
            var panel = new PanelModel({ isViewing: true });
            var dashboard = new DashboardModel({});
            var menuItems = getPanelMenu(dashboard, panel, angularComponent);
            expect(menuItems).toMatchInlineSnapshot("\n        Array [\n          Object {\n            \"iconClassName\": \"eye\",\n            \"onClick\": [Function],\n            \"shortcut\": \"v\",\n            \"text\": \"View\",\n          },\n          Object {\n            \"iconClassName\": \"edit\",\n            \"onClick\": [Function],\n            \"shortcut\": \"e\",\n            \"text\": \"Edit\",\n          },\n          Object {\n            \"iconClassName\": \"share-alt\",\n            \"onClick\": [Function],\n            \"shortcut\": \"p s\",\n            \"text\": \"Share\",\n          },\n          Object {\n            \"iconClassName\": \"compass\",\n            \"onClick\": [Function],\n            \"shortcut\": \"x\",\n            \"text\": \"Explore\",\n          },\n          Object {\n            \"iconClassName\": \"info-circle\",\n            \"onClick\": [Function],\n            \"shortcut\": \"i\",\n            \"subMenu\": Array [\n              Object {\n                \"onClick\": [Function],\n                \"text\": \"Panel JSON\",\n              },\n            ],\n            \"text\": \"Inspect\",\n            \"type\": \"submenu\",\n          },\n          Object {\n            \"iconClassName\": \"cube\",\n            \"onClick\": [Function],\n            \"subMenu\": Array [\n              Object {\n                \"href\": undefined,\n                \"onClick\": [Function],\n                \"shortcut\": \"p l\",\n                \"text\": \"Toggle legend\",\n              },\n            ],\n            \"text\": \"More...\",\n            \"type\": \"submenu\",\n          },\n        ]\n      ");
        });
    });
    describe('onNavigateToExplore', function () {
        var testSubUrl = '/testSubUrl';
        var testUrl = '/testUrl';
        var windowOpen = jest.fn();
        var event;
        var explore;
        var navigateSpy;
        beforeAll(function () {
            var panel = new PanelModel({});
            var dashboard = new DashboardModel({});
            var menuItems = getPanelMenu(dashboard, panel);
            explore = menuItems.find(function (item) { return item.text === 'Explore'; });
            navigateSpy = jest.spyOn(actions, 'navigateToExplore');
            window.open = windowOpen;
            event = {
                ctrlKey: true,
                preventDefault: jest.fn(),
            };
            setStore({ dispatch: jest.fn() });
        });
        it('should navigate to url without subUrl', function () {
            explore.onClick(event);
            var openInNewWindow = navigateSpy.mock.calls[0][1].openInNewWindow;
            openInNewWindow(testUrl);
            expect(windowOpen).toHaveBeenLastCalledWith(testUrl);
        });
        it('should navigate to url with subUrl', function () {
            config.appSubUrl = testSubUrl;
            explore.onClick(event);
            var openInNewWindow = navigateSpy.mock.calls[0][1].openInNewWindow;
            openInNewWindow(testUrl);
            expect(windowOpen).toHaveBeenLastCalledWith("" + testSubUrl + testUrl);
        });
    });
});
//# sourceMappingURL=getPanelMenu.test.js.map