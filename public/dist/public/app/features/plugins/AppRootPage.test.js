import { __assign, __awaiter, __extends, __generator } from "tslib";
import { act, render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import AppRootPage from './AppRootPage';
import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin } from './plugin_loader';
import { getMockPlugin } from './__mocks__/pluginMocks';
import { AppPlugin, PluginType } from '@grafana/data';
import { Route, Router } from 'react-router-dom';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { Echo } from 'app/core/services/echo/Echo';
jest.mock('./PluginSettingsCache', function () { return ({
    getPluginSettings: jest.fn(),
}); });
jest.mock('./plugin_loader', function () { return ({
    importAppPlugin: jest.fn(),
}); });
var importAppPluginMock = importAppPlugin;
var getPluginSettingsMock = getPluginSettings;
var RootComponent = /** @class */ (function (_super) {
    __extends(RootComponent, _super);
    function RootComponent() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    RootComponent.prototype.componentDidMount = function () {
        RootComponent.timesMounted += 1;
        var node = {
            text: 'My Great plugin',
            children: [
                {
                    text: 'A page',
                    url: '/apage',
                    id: 'a',
                },
                {
                    text: 'Another page',
                    url: '/anotherpage',
                    id: 'b',
                },
            ],
        };
        this.props.onNavChanged({
            main: node,
            node: node,
        });
    };
    RootComponent.prototype.render = function () {
        return React.createElement("p", null, "my great plugin");
    };
    RootComponent.timesMounted = 0;
    return RootComponent;
}(Component));
function renderUnderRouter() {
    var route = { component: AppRootPage };
    locationService.push('/a/my-awesome-plugin');
    render(React.createElement(Router, { history: locationService.getHistory() },
        React.createElement(Route, { path: "/a/:pluginId", exact: true, render: function (props) { return React.createElement(GrafanaRoute, __assign({}, props, { route: route })); } })));
}
describe('AppRootPage', function () {
    beforeEach(function () {
        jest.resetAllMocks();
        setEchoSrv(new Echo());
    });
    it('should not mount plugin twice if nav is changed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var plugin, _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    // reproduces https://github.com/grafana/grafana/pull/28105
                    getPluginSettingsMock.mockResolvedValue(getMockPlugin({
                        type: PluginType.app,
                        enabled: true,
                    }));
                    plugin = new AppPlugin();
                    plugin.root = RootComponent;
                    importAppPluginMock.mockResolvedValue(plugin);
                    renderUnderRouter();
                    // check that plugin and nav links were rendered, and plugin is mounted only once
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('my great plugin')];
                case 1:
                    // check that plugin and nav links were rendered, and plugin is mounted only once
                    _a.apply(void 0, [_d.sent()]).toBeVisible();
                    _b = expect;
                    return [4 /*yield*/, screen.findByLabelText('Tab A page')];
                case 2:
                    _b.apply(void 0, [_d.sent()]).toBeVisible();
                    _c = expect;
                    return [4 /*yield*/, screen.findByLabelText('Tab Another page')];
                case 3:
                    _c.apply(void 0, [_d.sent()]).toBeVisible();
                    expect(RootComponent.timesMounted).toEqual(1);
                    return [2 /*return*/];
            }
        });
    }); });
    it('should not render component if not at plugin path', function () { return __awaiter(void 0, void 0, void 0, function () {
        var RootComponent, plugin, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    getPluginSettingsMock.mockResolvedValue(getMockPlugin({
                        type: PluginType.app,
                        enabled: true,
                    }));
                    RootComponent = /** @class */ (function (_super) {
                        __extends(RootComponent, _super);
                        function RootComponent() {
                            return _super !== null && _super.apply(this, arguments) || this;
                        }
                        RootComponent.prototype.render = function () {
                            RootComponent.timesRendered += 1;
                            return React.createElement("p", null, "my great component");
                        };
                        RootComponent.timesRendered = 0;
                        return RootComponent;
                    }(Component));
                    plugin = new AppPlugin();
                    plugin.root = RootComponent;
                    importAppPluginMock.mockResolvedValue(plugin);
                    renderUnderRouter();
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('my great component')];
                case 1:
                    _a.apply(void 0, [_b.sent()]).toBeVisible();
                    // renders the first time
                    expect(RootComponent.timesRendered).toEqual(1);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                locationService.push('/foo');
                                return [2 /*return*/];
                            });
                        }); })];
                case 2:
                    _b.sent();
                    expect(RootComponent.timesRendered).toEqual(1);
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                locationService.push('/a/my-awesome-plugin');
                                return [2 /*return*/];
                            });
                        }); })];
                case 3:
                    _b.sent();
                    expect(RootComponent.timesRendered).toEqual(2);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=AppRootPage.test.js.map