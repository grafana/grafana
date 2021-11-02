import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { Router } from 'react-router-dom';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { locationService } from '@grafana/runtime';
import { PluginType } from '@grafana/data';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';
import { fetchRemotePlugins } from '../state/actions';
import { PluginAdminRoutes, RequestStatus } from '../types';
import { getCatalogPluginMock, getPluginsStateMock } from '../__mocks__';
import BrowsePage from './Browse';
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    var mockedRuntime = __assign({}, original);
    mockedRuntime.config.bootData.user.isGrafanaAdmin = true;
    mockedRuntime.config.buildInfo.version = 'v8.1.0';
    return mockedRuntime;
});
var renderBrowse = function (path, plugins, pluginsStateOverride) {
    if (path === void 0) { path = '/plugins'; }
    if (plugins === void 0) { plugins = []; }
    var store = configureStore({ plugins: pluginsStateOverride || getPluginsStateMock(plugins) });
    locationService.push(path);
    var props = getRouteComponentProps({
        route: { routeName: PluginAdminRoutes.Home },
    });
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(BrowsePage, __assign({}, props)))));
};
describe('Browse list of plugins', function () {
    describe('when filtering', function () {
        it('should list installed plugins by default', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins', [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: false }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Plugin 1')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(queryByText('Plugin 1')).toBeInTheDocument();
                        expect(queryByText('Plugin 2')).toBeInTheDocument();
                        expect(queryByText('Plugin 3')).toBeInTheDocument();
                        expect(queryByText('Plugin 4')).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should list all plugins (except core plugins) when filtering by all', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=all&filterByType=all', [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isCore: true }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Plugin 1')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(queryByText('Plugin 2')).toBeInTheDocument();
                        expect(queryByText('Plugin 3')).toBeInTheDocument();
                        // Core plugins should not be listed
                        expect(queryByText('Plugin 4')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should list installed plugins (including core plugins) when filtering by installed', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=installed', [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isCore: true }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Plugin 1')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(queryByText('Plugin 3')).toBeInTheDocument();
                        expect(queryByText('Plugin 4')).toBeInTheDocument();
                        // Not showing not installed plugins
                        expect(queryByText('Plugin 2')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should list all plugins (including disabled plugins) when filtering by all', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=all&filterByType=all', [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isDisabled: true }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Plugin 1')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(queryByText('Plugin 2')).toBeInTheDocument();
                        expect(queryByText('Plugin 3')).toBeInTheDocument();
                        expect(queryByText('Plugin 4')).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should list installed plugins (including disabled plugins) when filtering by installed', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=installed', [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: false }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 4', isInstalled: true, isDisabled: true }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Plugin 1')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(queryByText('Plugin 3')).toBeInTheDocument();
                        expect(queryByText('Plugin 4')).toBeInTheDocument();
                        // Not showing not installed plugins
                        expect(queryByText('Plugin 2')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should list enterprise plugins when querying for them', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=all&q=wavefront', [
                            getCatalogPluginMock({ id: 'wavefront', name: 'Wavefront', isInstalled: true, isEnterprise: true }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', isInstalled: true, isCore: true }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', isInstalled: true }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Wavefront')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        // Should not show plugins that don't match the query
                        expect(queryByText('Plugin 2')).not.toBeInTheDocument();
                        expect(queryByText('Plugin 3')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should list only datasource plugins when filtering by datasource', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=all&filterByType=datasource', [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.datasource }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.panel }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Plugin 2')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        // Other plugin types shouldn't be shown
                        expect(queryByText('Plugin 1')).not.toBeInTheDocument();
                        expect(queryByText('Plugin 3')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should list only panel plugins when filtering by panel', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=all&filterByType=panel', [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.datasource }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.panel }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Plugin 3')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        // Other plugin types shouldn't be shown
                        expect(queryByText('Plugin 1')).not.toBeInTheDocument();
                        expect(queryByText('Plugin 2')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should list only app plugins when filtering by app', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=all&filterByType=app', [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', type: PluginType.app }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2', type: PluginType.datasource }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3', type: PluginType.panel }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Plugin 1')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        // Other plugin types shouldn't be shown
                        expect(queryByText('Plugin 2')).not.toBeInTheDocument();
                        expect(queryByText('Plugin 3')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when searching', function () {
        it('should only list plugins matching search', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderBrowse('/plugins?filterBy=all&q=zabbix', [
                            getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
                            getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2' }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3' }),
                        ]).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Zabbix')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        // Other plugin types shouldn't be shown
                        expect(queryByText('Plugin 2')).not.toBeInTheDocument();
                        expect(queryByText('Plugin 3')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when sorting', function () {
        it('should sort plugins by name in ascending alphabetical order', function () { return __awaiter(void 0, void 0, void 0, function () {
            var findByTestId, pluginList, pluginHeadings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        findByTestId = renderBrowse('/plugins?filterBy=all', [
                            getCatalogPluginMock({ id: 'wavefront', name: 'Wavefront' }),
                            getCatalogPluginMock({ id: 'redis-application', name: 'Redis Application' }),
                            getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
                            getCatalogPluginMock({ id: 'diagram', name: 'Diagram' }),
                            getCatalogPluginMock({ id: 'acesvg', name: 'ACE.SVG' }),
                        ]).findByTestId;
                        return [4 /*yield*/, findByTestId('plugin-list')];
                    case 1:
                        pluginList = _a.sent();
                        pluginHeadings = within(pluginList).queryAllByRole('heading');
                        expect(pluginHeadings.map(function (heading) { return heading.innerHTML; })).toStrictEqual([
                            'ACE.SVG',
                            'Diagram',
                            'Redis Application',
                            'Wavefront',
                            'Zabbix',
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should sort plugins by name in descending alphabetical order', function () { return __awaiter(void 0, void 0, void 0, function () {
            var findByTestId, pluginList, pluginHeadings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        findByTestId = renderBrowse('/plugins?filterBy=all&sortBy=nameDesc', [
                            getCatalogPluginMock({ id: 'wavefront', name: 'Wavefront' }),
                            getCatalogPluginMock({ id: 'redis-application', name: 'Redis Application' }),
                            getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
                            getCatalogPluginMock({ id: 'diagram', name: 'Diagram' }),
                            getCatalogPluginMock({ id: 'acesvg', name: 'ACE.SVG' }),
                        ]).findByTestId;
                        return [4 /*yield*/, findByTestId('plugin-list')];
                    case 1:
                        pluginList = _a.sent();
                        pluginHeadings = within(pluginList).queryAllByRole('heading');
                        expect(pluginHeadings.map(function (heading) { return heading.innerHTML; })).toStrictEqual([
                            'Zabbix',
                            'Wavefront',
                            'Redis Application',
                            'Diagram',
                            'ACE.SVG',
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should sort plugins by date in ascending updated order', function () { return __awaiter(void 0, void 0, void 0, function () {
            var findByTestId, pluginList, pluginHeadings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        findByTestId = renderBrowse('/plugins?filterBy=all&sortBy=updated', [
                            getCatalogPluginMock({ id: '1', name: 'Wavefront', updatedAt: '2021-04-01T00:00:00.000Z' }),
                            getCatalogPluginMock({ id: '2', name: 'Redis Application', updatedAt: '2021-02-01T00:00:00.000Z' }),
                            getCatalogPluginMock({ id: '3', name: 'Zabbix', updatedAt: '2021-01-01T00:00:00.000Z' }),
                            getCatalogPluginMock({ id: '4', name: 'Diagram', updatedAt: '2021-05-01T00:00:00.000Z' }),
                            getCatalogPluginMock({ id: '5', name: 'ACE.SVG', updatedAt: '2021-02-01T00:00:00.000Z' }),
                        ]).findByTestId;
                        return [4 /*yield*/, findByTestId('plugin-list')];
                    case 1:
                        pluginList = _a.sent();
                        pluginHeadings = within(pluginList).queryAllByRole('heading');
                        expect(pluginHeadings.map(function (heading) { return heading.innerHTML; })).toStrictEqual([
                            'Diagram',
                            'Wavefront',
                            'Redis Application',
                            'ACE.SVG',
                            'Zabbix',
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should sort plugins by date in ascending published order', function () { return __awaiter(void 0, void 0, void 0, function () {
            var findByTestId, pluginList, pluginHeadings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        findByTestId = renderBrowse('/plugins?filterBy=all&sortBy=published', [
                            getCatalogPluginMock({ id: '1', name: 'Wavefront', publishedAt: '2021-04-01T00:00:00.000Z' }),
                            getCatalogPluginMock({ id: '2', name: 'Redis Application', publishedAt: '2021-02-01T00:00:00.000Z' }),
                            getCatalogPluginMock({ id: '3', name: 'Zabbix', publishedAt: '2021-01-01T00:00:00.000Z' }),
                            getCatalogPluginMock({ id: '4', name: 'Diagram', publishedAt: '2021-05-01T00:00:00.000Z' }),
                            getCatalogPluginMock({ id: '5', name: 'ACE.SVG', publishedAt: '2021-02-01T00:00:00.000Z' }),
                        ]).findByTestId;
                        return [4 /*yield*/, findByTestId('plugin-list')];
                    case 1:
                        pluginList = _a.sent();
                        pluginHeadings = within(pluginList).queryAllByRole('heading');
                        expect(pluginHeadings.map(function (heading) { return heading.innerHTML; })).toStrictEqual([
                            'Diagram',
                            'Wavefront',
                            'Redis Application',
                            'ACE.SVG',
                            'Zabbix',
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should sort plugins by number of downloads in ascending order', function () { return __awaiter(void 0, void 0, void 0, function () {
            var findByTestId, pluginList, pluginHeadings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        findByTestId = renderBrowse('/plugins?filterBy=all&sortBy=downloads', [
                            getCatalogPluginMock({ id: '1', name: 'Wavefront', downloads: 30 }),
                            getCatalogPluginMock({ id: '2', name: 'Redis Application', downloads: 10 }),
                            getCatalogPluginMock({ id: '3', name: 'Zabbix', downloads: 50 }),
                            getCatalogPluginMock({ id: '4', name: 'Diagram', downloads: 20 }),
                            getCatalogPluginMock({ id: '5', name: 'ACE.SVG', downloads: 40 }),
                        ]).findByTestId;
                        return [4 /*yield*/, findByTestId('plugin-list')];
                    case 1:
                        pluginList = _a.sent();
                        pluginHeadings = within(pluginList).queryAllByRole('heading');
                        expect(pluginHeadings.map(function (heading) { return heading.innerHTML; })).toStrictEqual([
                            'Zabbix',
                            'ACE.SVG',
                            'Wavefront',
                            'Diagram',
                            'Redis Application',
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when GCOM api is not available', function () {
        it('should disable the All / Installed filter', function () { return __awaiter(void 0, void 0, void 0, function () {
            var plugins, state, stateOverride, getByRole;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        plugins = [
                            getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 2', isInstalled: true }),
                            getCatalogPluginMock({ id: 'plugin-4', name: 'Plugin 3', isInstalled: true }),
                        ];
                        state = getPluginsStateMock(plugins);
                        stateOverride = __assign(__assign({}, state), { requests: __assign(__assign({}, state.requests), (_a = {}, _a[fetchRemotePlugins.typePrefix] = {
                                status: RequestStatus.Rejected,
                            }, _a)) });
                        getByRole = renderBrowse('/plugins', [], stateOverride).getByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(getByRole('radio', { name: 'Installed' })).toBeDisabled(); })];
                    case 1:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    it('should be possible to switch between display modes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, findByTestId, getByRole, getByTitle, queryByText, listOptionTitle, gridOptionTitle, listOption, listOptionLabel, gridOption, gridOptionLabel;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = renderBrowse('/plugins?filterBy=all', [
                        getCatalogPluginMock({ id: 'plugin-1', name: 'Plugin 1' }),
                        getCatalogPluginMock({ id: 'plugin-2', name: 'Plugin 2' }),
                        getCatalogPluginMock({ id: 'plugin-3', name: 'Plugin 3' }),
                    ]), findByTestId = _a.findByTestId, getByRole = _a.getByRole, getByTitle = _a.getByTitle, queryByText = _a.queryByText;
                    return [4 /*yield*/, findByTestId('plugin-list')];
                case 1:
                    _b.sent();
                    listOptionTitle = 'Display plugins in list';
                    gridOptionTitle = 'Display plugins in a grid layout';
                    listOption = getByRole('radio', { name: listOptionTitle });
                    listOptionLabel = getByTitle(listOptionTitle);
                    gridOption = getByRole('radio', { name: gridOptionTitle });
                    gridOptionLabel = getByTitle(gridOptionTitle);
                    // All options should be visible
                    expect(listOptionLabel).toBeVisible();
                    expect(gridOptionLabel).toBeVisible();
                    // The default display mode should be "grid"
                    expect(gridOption).toBeChecked();
                    expect(listOption).not.toBeChecked();
                    // Switch to "list" view
                    userEvent.click(listOption);
                    expect(gridOption).not.toBeChecked();
                    expect(listOption).toBeChecked();
                    // All plugins are still visible
                    expect(queryByText('Plugin 1')).toBeInTheDocument();
                    expect(queryByText('Plugin 2')).toBeInTheDocument();
                    expect(queryByText('Plugin 3')).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=Browse.test.js.map