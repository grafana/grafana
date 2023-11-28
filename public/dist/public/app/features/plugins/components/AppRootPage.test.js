import { __awaiter } from "tslib";
import { act, render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { Route, Router } from 'react-router-dom';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { AppPlugin, PluginType, PluginIncludeType, OrgRole } from '@grafana/data';
import { getMockPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { GrafanaRoute } from 'app/core/navigation/GrafanaRoute';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import { configureStore } from 'app/store/configureStore';
import { getPluginSettings } from '../pluginSettings';
import { importAppPlugin } from '../plugin_loader';
import AppRootPage from './AppRootPage';
jest.mock('../pluginSettings', () => ({
    getPluginSettings: jest.fn(),
}));
jest.mock('../plugin_loader', () => ({
    importAppPlugin: jest.fn(),
}));
const importAppPluginMock = importAppPlugin;
const getPluginSettingsMock = getPluginSettings;
class RootComponent extends Component {
    render() {
        RootComponent.timesRendered += 1;
        return React.createElement("p", null, "my great component");
    }
}
RootComponent.timesRendered = 0;
function renderUnderRouter(page = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const appPluginNavItem = {
            text: 'App',
            id: 'plugin-page-app',
            url: '/a/plugin-page-app',
            children: [
                {
                    text: 'Page 1',
                    url: '/a/plugin-page-app/page-1',
                },
                {
                    text: 'Page 2',
                    url: '/a/plugin-page-app/page-2',
                },
            ],
        };
        const appsSection = {
            text: 'apps',
            id: 'apps',
            children: [appPluginNavItem],
        };
        appPluginNavItem.parentItem = appsSection;
        const pagePath = page ? `/${page}` : '';
        const store = configureStore();
        const route = {
            component: () => React.createElement(AppRootPage, { pluginId: "my-awesome-plugin", pluginNavSection: appsSection }),
        };
        yield act(() => __awaiter(this, void 0, void 0, function* () {
            locationService.push(`/a/my-awesome-plugin${pagePath}`);
        }));
        render(React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(Provider, { store: store },
                React.createElement(GrafanaContext.Provider, { value: getGrafanaContextMock() },
                    React.createElement(Route, { path: `/a/:pluginId${pagePath}`, exact: true, render: (props) => React.createElement(GrafanaRoute, Object.assign({}, props, { route: route })) })))));
    });
}
describe('AppRootPage', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        setEchoSrv(new Echo());
    });
    const pluginMeta = getMockPlugin({
        id: 'my-awesome-plugin',
        type: PluginType.app,
        enabled: true,
    });
    it('should not render the component if we are not under a plugin path', () => __awaiter(void 0, void 0, void 0, function* () {
        getPluginSettingsMock.mockResolvedValue(pluginMeta);
        const plugin = new AppPlugin();
        plugin.meta = pluginMeta;
        plugin.root = RootComponent;
        importAppPluginMock.mockResolvedValue(plugin);
        // Renders once for the first time
        yield renderUnderRouter();
        expect(yield screen.findByText('my great component')).toBeVisible();
        expect(RootComponent.timesRendered).toEqual(1);
        // Does not render again when navigating to a non-plugin path
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            locationService.push('/foo');
        }));
        expect(RootComponent.timesRendered).toEqual(1);
        // Renders it again when navigating back to a plugin path
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            locationService.push('/a/my-awesome-plugin');
        }));
        expect(RootComponent.timesRendered).toEqual(2);
    }));
    describe('When accessing using different roles', () => {
        beforeEach(() => {
            const pluginMetaWithIncludes = getMockPlugin({
                id: 'my-awesome-plugin',
                type: PluginType.app,
                enabled: true,
                includes: [
                    {
                        type: PluginIncludeType.page,
                        name: 'Awesome page 1',
                        path: '/a/my-awesome-plugin/viewer-page',
                        role: 'Viewer',
                    },
                    {
                        type: PluginIncludeType.page,
                        name: 'Awesome page 2',
                        path: '/a/my-awesome-plugin/editor-page',
                        role: 'Editor',
                    },
                    {
                        type: PluginIncludeType.page,
                        name: 'Awesome page 2',
                        path: '/a/my-awesome-plugin/admin-page',
                        role: 'Admin',
                    },
                    {
                        type: PluginIncludeType.page,
                        name: 'Awesome page with mistake',
                        path: '/a/my-awesome-plugin/mistake-page',
                        role: 'NotExistingRole',
                    },
                    {
                        type: PluginIncludeType.page,
                        name: 'Awesome page 2',
                        path: '/a/my-awesome-plugin/page-without-role',
                    },
                ],
            });
            getPluginSettingsMock.mockResolvedValue(pluginMetaWithIncludes);
            const plugin = new AppPlugin();
            plugin.meta = pluginMetaWithIncludes;
            plugin.root = RootComponent;
            importAppPluginMock.mockResolvedValue(plugin);
        });
        it('an User should not be able to see page with not existing role', () => __awaiter(void 0, void 0, void 0, function* () {
            contextSrv.user.orgRole = OrgRole.Editor;
            yield renderUnderRouter('mistake-page');
            expect(yield screen.findByText('Access denied')).toBeVisible();
        }));
        it('a Viewer should only have access to pages with "Viewer" roles', () => __awaiter(void 0, void 0, void 0, function* () {
            contextSrv.user.orgRole = OrgRole.Viewer;
            // Viewer has access to a plugin entry page by default
            yield renderUnderRouter('');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Viewer has access to a page without roles
            yield renderUnderRouter('page-without-role');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Viewer has access to Viewer page
            yield renderUnderRouter('viewer-page');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Viewer does not have access to Editor page
            yield renderUnderRouter('editor-page');
            expect(yield screen.findByText('Access denied')).toBeVisible();
            // Viewer does not have access to a Admin page
            yield renderUnderRouter('admin-page');
            expect(yield screen.findByText('Access denied')).toBeVisible();
        }));
        it('an Editor should have access to pages with both "Viewer" and "Editor" roles', () => __awaiter(void 0, void 0, void 0, function* () {
            contextSrv.user.orgRole = OrgRole.Editor;
            contextSrv.isEditor = true;
            // Viewer has access to a plugin entry page by default
            yield renderUnderRouter('');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Editor has access to a page without roles
            yield renderUnderRouter('page-without-role');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Editor has access to Viewer page
            yield renderUnderRouter('viewer-page');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Editor has access to Editor page
            yield renderUnderRouter('editor-page');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Editor does not have access to a Admin page
            yield renderUnderRouter('admin-page');
            expect(yield screen.findByText('Access denied')).toBeVisible();
        }));
        it('a Grafana Admin should be able to see any page', () => __awaiter(void 0, void 0, void 0, function* () {
            contextSrv.isGrafanaAdmin = true;
            // Viewer has access to a plugin entry page
            yield renderUnderRouter('');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Admin has access to a page without roles
            yield renderUnderRouter('page-without-role');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Admin has access to Viewer page
            yield renderUnderRouter('viewer-page');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Admin has access to Editor page
            yield renderUnderRouter('editor-page');
            expect(yield screen.findByText('my great component')).toBeVisible();
            // Admin has access to a Admin page
            yield renderUnderRouter('admin-page');
            expect(yield screen.findByText('my great component')).toBeVisible();
        }));
    });
});
//# sourceMappingURL=AppRootPage.test.js.map