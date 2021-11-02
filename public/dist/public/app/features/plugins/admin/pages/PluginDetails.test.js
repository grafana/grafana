import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { config } from '@grafana/runtime';
import { mockPluginApis, getCatalogPluginMock, getPluginsStateMock, mockUserPermissions } from '../__mocks__';
import { configureStore } from 'app/store/configureStore';
import PluginDetailsPage from './PluginDetails';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { PluginTabIds, RequestStatus } from '../types';
import * as api from '../api';
import { fetchRemotePlugins } from '../state/actions';
import { PluginErrorCode, PluginSignatureStatus, PluginType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    var mockedRuntime = __assign({}, original);
    mockedRuntime.config.buildInfo.version = 'v8.1.0';
    return mockedRuntime;
});
var renderPluginDetails = function (pluginOverride, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.pageId, pageId = _c === void 0 ? PluginTabIds.OVERVIEW : _c, pluginsStateOverride = _b.pluginsStateOverride;
    var plugin = getCatalogPluginMock(pluginOverride);
    var id = plugin.id;
    var props = getRouteComponentProps({
        match: { params: { pluginId: id }, isExact: true, url: '', path: '' },
        queryParams: { page: pageId },
        location: {
            hash: '',
            pathname: "/plugins/" + id,
            search: "?page=" + pageId,
            state: undefined,
        },
    });
    var store = configureStore({
        plugins: pluginsStateOverride || getPluginsStateMock([plugin]),
    });
    return render(React.createElement(MemoryRouter, null,
        React.createElement(Provider, { store: store },
            React.createElement(PluginDetailsPage, __assign({}, props)))));
};
describe('Plugin details page', function () {
    var id = 'my-plugin';
    var dateNow;
    beforeAll(function () {
        dateNow = jest.spyOn(Date, 'now').mockImplementation(function () { return 1609470000000; }); // 2021-01-01 04:00:00
    });
    afterEach(function () {
        jest.clearAllMocks();
        config.pluginAdminExternalManageEnabled = false;
        config.licenseInfo.hasValidLicense = false;
    });
    afterAll(function () {
        dateNow.mockRestore();
    });
    describe('viewed as user with grafana admin permissions', function () {
        beforeAll(function () {
            mockUserPermissions({
                isAdmin: true,
                isDataSourceEditor: true,
                isOrgAdmin: true,
            });
        });
        // We are doing this very basic test to see if the API fetching and data-munging is working correctly from a high-level.
        it('(SMOKE TEST) - should fetch and merge the remote and local plugin API responses correctly ', function () { return __awaiter(void 0, void 0, void 0, function () {
            var id, props, store, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        id = 'smoke-test-plugin';
                        mockPluginApis({
                            remote: { slug: id },
                            local: { id: id },
                        });
                        props = getRouteComponentProps({
                            match: { params: { pluginId: id }, isExact: true, url: '', path: '' },
                            queryParams: { page: PluginTabIds.OVERVIEW },
                            location: {
                                hash: '',
                                pathname: "/plugins/" + id,
                                search: "?page=" + PluginTabIds.OVERVIEW,
                                state: undefined,
                            },
                        });
                        store = configureStore();
                        queryByText = render(React.createElement(MemoryRouter, null,
                            React.createElement(Provider, { store: store },
                                React.createElement(PluginDetailsPage, __assign({}, props))),
                            ",")).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display an overview (plugin readme) by default', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderPluginDetails({ id: id }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText(/licensed under the apache 2.0 license/i)).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display the number of downloads in the header', function () { return __awaiter(void 0, void 0, void 0, function () {
            var downloads, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        downloads = 24324;
                        queryByText = renderPluginDetails({ id: id, downloads: downloads }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText(new Intl.NumberFormat().format(downloads))).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display the version in the header', function () { return __awaiter(void 0, void 0, void 0, function () {
            var version, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        version = '1.3.443';
                        queryByText = renderPluginDetails({ id: id, version: version }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText(version)).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display description in the header', function () { return __awaiter(void 0, void 0, void 0, function () {
            var description, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        description = 'This is my description';
                        queryByText = renderPluginDetails({ id: id, description: description }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText(description)).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display a "Signed" badge if the plugin signature is verified', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderPluginDetails({ id: id, signature: PluginSignatureStatus.valid }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Signed')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display a "Missing signature" badge if the plugin signature is missing', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderPluginDetails({ id: id, signature: PluginSignatureStatus.missing }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Missing signature')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display a "Modified signature" badge if the plugin signature is modified', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderPluginDetails({ id: id, signature: PluginSignatureStatus.modified }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Modified signature')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display a "Invalid signature" badge if the plugin signature is invalid', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderPluginDetails({ id: id, signature: PluginSignatureStatus.invalid }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Invalid signature')).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display version history in case it is available', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, queryByText, getByRole;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = renderPluginDetails({
                            id: id,
                            details: {
                                links: [],
                                versions: [
                                    {
                                        version: '1.0.0',
                                        createdAt: '2016-04-06T20:23:41.000Z',
                                    },
                                ],
                            },
                        }, { pageId: PluginTabIds.VERSIONS }), queryByText = _a.queryByText, getByRole = _a.getByRole;
                        // Check if version information is available
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText(/version history/i)).toBeInTheDocument(); })];
                    case 1:
                        // Check if version information is available
                        _b.sent();
                        expect(getByRole('columnheader', {
                            name: /version/i,
                        })).toBeInTheDocument();
                        expect(getByRole('columnheader', {
                            name: /last updated/i,
                        })).toBeInTheDocument();
                        expect(getByRole('cell', {
                            name: /1\.0\.0/i,
                        })).toBeInTheDocument();
                        expect(getByRole('cell', {
                            name: /5 years ago/i,
                        })).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it("should display an install button for a plugin that isn't installed", function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByRole = renderPluginDetails({ id: id, isInstalled: false }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /install/i })).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display an uninstall button for an already installed plugin', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByRole = renderPluginDetails({ id: id, isInstalled: true }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display update and uninstall buttons for a plugin with update', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByRole = renderPluginDetails({ id: id, isInstalled: true, hasUpdate: true }).queryByRole;
                        // Displays an "update" button
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /update/i })).toBeInTheDocument(); })];
                    case 1:
                        // Displays an "update" button
                        _a.sent();
                        // Does not display "install" and "uninstall" buttons
                        expect(queryByRole('button', { name: /install/i })).toBeInTheDocument();
                        expect(queryByRole('button', { name: /uninstall/i })).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display an install button for enterprise plugins if license is valid', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        config.licenseInfo.hasValidLicense = true;
                        queryByRole = renderPluginDetails({ id: id, isInstalled: false, isEnterprise: true }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /install/i })).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display install button for enterprise plugins if license is invalid', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, queryByRole, queryByText;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        config.licenseInfo.hasValidLicense = false;
                        _a = renderPluginDetails({ id: id, isInstalled: true, isEnterprise: true }), queryByRole = _a.queryByRole, queryByText = _a.queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /install/i })).not.toBeInTheDocument(); })];
                    case 1:
                        _b.sent();
                        expect(queryByText(/no valid Grafana Enterprise license detected/i)).toBeInTheDocument();
                        expect(queryByRole('link', { name: /learn more/i })).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display install / uninstall buttons for core plugins', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByRole = renderPluginDetails({ id: id, isInstalled: true, isCore: true }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument(); })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display install / uninstall buttons for disabled plugins', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByRole = renderPluginDetails({ id: id, isInstalled: true, isDisabled: true }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument(); })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display install / uninstall buttons for renderer plugins', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByRole = renderPluginDetails({ id: id, type: PluginType.renderer }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument(); })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display install link with `config.pluginAdminExternalManageEnabled` set to true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        config.pluginAdminExternalManageEnabled = true;
                        queryByRole = renderPluginDetails({ id: id, isInstalled: false }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('link', { name: /install via grafana.com/i })).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display uninstall link for an installed plugin with `config.pluginAdminExternalManageEnabled` set to true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        config.pluginAdminExternalManageEnabled = true;
                        queryByRole = renderPluginDetails({ id: id, isInstalled: true }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('link', { name: /uninstall via grafana.com/i })).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display update and uninstall links for a plugin with an available update and `config.pluginAdminExternalManageEnabled` set to true', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByRole;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        config.pluginAdminExternalManageEnabled = true;
                        queryByRole = renderPluginDetails({ id: id, isInstalled: true, hasUpdate: true }).queryByRole;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('link', { name: /update via grafana.com/i })).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(queryByRole('link', { name: /uninstall via grafana.com/i })).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display alert with information about why the plugin is disabled', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByLabelText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByLabelText = renderPluginDetails({
                            id: id,
                            isInstalled: true,
                            isDisabled: true,
                            error: PluginErrorCode.modifiedSignature,
                        }).queryByLabelText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByLabelText(selectors.pages.PluginPage.disabledInfo)).toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display grafana dependencies for a plugin if they are available', function () { return __awaiter(void 0, void 0, void 0, function () {
            var queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queryByText = renderPluginDetails({
                            id: id,
                            details: {
                                pluginDependencies: [],
                                grafanaDependency: '>=8.0.0',
                                links: [],
                            },
                        }).queryByText;
                        // Wait for the dependencies part to be loaded
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText(/dependencies:/i)).toBeInTheDocument(); })];
                    case 1:
                        // Wait for the dependencies part to be loaded
                        _a.sent();
                        expect(queryByText('Grafana >=8.0.0')).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should show a confirm modal when trying to uninstall a plugin', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, queryByText, queryByRole, getByRole;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // @ts-ignore
                        api.uninstallPlugin = jest.fn();
                        _a = renderPluginDetails({
                            id: id,
                            name: 'Akumuli',
                            isInstalled: true,
                            details: {
                                pluginDependencies: [],
                                grafanaDependency: '>=8.0.0',
                                links: [],
                            },
                        }), queryByText = _a.queryByText, queryByRole = _a.queryByRole, getByRole = _a.getByRole;
                        // Wait for the install controls to be loaded
                        return [4 /*yield*/, waitFor(function () { return expect(queryByRole('button', { name: /install/i })).toBeInTheDocument(); })];
                    case 1:
                        // Wait for the install controls to be loaded
                        _b.sent();
                        // Open the confirmation modal
                        userEvent.click(getByRole('button', { name: /uninstall/i }));
                        expect(queryByText('Uninstall Akumuli')).toBeInTheDocument();
                        expect(queryByText('Are you sure you want to uninstall this plugin?')).toBeInTheDocument();
                        expect(api.uninstallPlugin).toHaveBeenCalledTimes(0);
                        // Confirm the uninstall
                        userEvent.click(getByRole('button', { name: /confirm/i }));
                        expect(api.uninstallPlugin).toHaveBeenCalledTimes(1);
                        expect(api.uninstallPlugin).toHaveBeenCalledWith(id);
                        // Check if the modal disappeared
                        expect(queryByText('Uninstall Akumuli')).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display the install / uninstall / update buttons if the GCOM api is not available', function () { return __awaiter(void 0, void 0, void 0, function () {
            var rendered, plugin, state, pluginsStateOverride, message;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        plugin = getCatalogPluginMock({ id: id });
                        state = getPluginsStateMock([plugin]);
                        pluginsStateOverride = __assign(__assign({}, state), { requests: __assign(__assign({}, state.requests), (_a = {}, _a[fetchRemotePlugins.typePrefix] = {
                                status: RequestStatus.Rejected,
                            }, _a)) });
                        // Does not show an Install button
                        rendered = renderPluginDetails({ id: id }, { pluginsStateOverride: pluginsStateOverride });
                        return [4 /*yield*/, waitFor(function () { return expect(rendered.queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument(); })];
                    case 1:
                        _b.sent();
                        rendered.unmount();
                        // Does not show a Uninstall button
                        rendered = renderPluginDetails({ id: id, isInstalled: true }, { pluginsStateOverride: pluginsStateOverride });
                        return [4 /*yield*/, waitFor(function () { return expect(rendered.queryByRole('button', { name: /(un)?install/i })).not.toBeInTheDocument(); })];
                    case 2:
                        _b.sent();
                        rendered.unmount();
                        // Does not show an Update button
                        rendered = renderPluginDetails({ id: id, isInstalled: true, hasUpdate: true }, { pluginsStateOverride: pluginsStateOverride });
                        return [4 /*yield*/, waitFor(function () { return expect(rendered.queryByRole('button', { name: /update/i })).not.toBeInTheDocument(); })];
                    case 3:
                        _b.sent();
                        message = 'The install controls have been disabled because the Grafana server cannot access grafana.com.';
                        expect(rendered.getByText(message)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display post installation step for installed data source plugins', function () { return __awaiter(void 0, void 0, void 0, function () {
            var name, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        name = 'Akumuli';
                        queryByText = renderPluginDetails({
                            name: name,
                            isInstalled: true,
                            type: PluginType.datasource,
                        }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return queryByText('Uninstall'); })];
                    case 1:
                        _a.sent();
                        expect(queryByText("Create a " + name + " data source")).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display post installation step for disabled data source plugins', function () { return __awaiter(void 0, void 0, void 0, function () {
            var name, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        name = 'Akumuli';
                        queryByText = renderPluginDetails({
                            name: name,
                            isInstalled: true,
                            isDisabled: true,
                            type: PluginType.datasource,
                        }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return queryByText('Uninstall'); })];
                    case 1:
                        _a.sent();
                        expect(queryByText("Create a " + name + " data source")).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display post installation step for panel plugins', function () { return __awaiter(void 0, void 0, void 0, function () {
            var name, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        name = 'Akumuli';
                        queryByText = renderPluginDetails({
                            name: name,
                            isInstalled: true,
                            type: PluginType.panel,
                        }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return queryByText('Uninstall'); })];
                    case 1:
                        _a.sent();
                        expect(queryByText("Create a " + name + " data source")).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display post installation step for app plugins', function () { return __awaiter(void 0, void 0, void 0, function () {
            var name, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        name = 'Akumuli';
                        queryByText = renderPluginDetails({
                            name: name,
                            isInstalled: true,
                            type: PluginType.app,
                        }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return queryByText('Uninstall'); })];
                    case 1:
                        _a.sent();
                        expect(queryByText("Create a " + name + " data source")).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('viewed as user without grafana admin permissions', function () {
        beforeAll(function () {
            mockUserPermissions({
                isAdmin: false,
                isDataSourceEditor: false,
                isOrgAdmin: false,
            });
        });
        it("should not display an install button for a plugin that isn't installed", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, queryByRole, queryByText;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = renderPluginDetails({ id: id, isInstalled: false }), queryByRole = _a.queryByRole, queryByText = _a.queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Overview')).toBeInTheDocument(); })];
                    case 1:
                        _b.sent();
                        expect(queryByRole('button', { name: /install/i })).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display an uninstall button for an already installed plugin', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, queryByRole, queryByText;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = renderPluginDetails({ id: id, isInstalled: true }), queryByRole = _a.queryByRole, queryByText = _a.queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Overview')).toBeInTheDocument(); })];
                    case 1:
                        _b.sent();
                        expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display update or uninstall buttons for a plugin with update', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, queryByRole, queryByText;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = renderPluginDetails({ id: id, isInstalled: true, hasUpdate: true }), queryByRole = _a.queryByRole, queryByText = _a.queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Overview')).toBeInTheDocument(); })];
                    case 1:
                        _b.sent();
                        expect(queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
                        expect(queryByRole('button', { name: /uninstall/i })).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should not display an install button for enterprise plugins if license is valid', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, queryByRole, queryByText;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        config.licenseInfo.hasValidLicense = true;
                        _a = renderPluginDetails({ id: id, isInstalled: false, isEnterprise: true }), queryByRole = _a.queryByRole, queryByText = _a.queryByText;
                        return [4 /*yield*/, waitFor(function () { return expect(queryByText('Overview')).toBeInTheDocument(); })];
                    case 1:
                        _b.sent();
                        expect(queryByRole('button', { name: /install/i })).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('viewed as user without data source edit permissions', function () {
        beforeAll(function () {
            mockUserPermissions({
                isAdmin: true,
                isDataSourceEditor: false,
                isOrgAdmin: true,
            });
        });
        it('should not display the data source post intallation step', function () { return __awaiter(void 0, void 0, void 0, function () {
            var name, queryByText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        name = 'Akumuli';
                        queryByText = renderPluginDetails({
                            name: name,
                            isInstalled: true,
                            type: PluginType.app,
                        }).queryByText;
                        return [4 /*yield*/, waitFor(function () { return queryByText('Uninstall'); })];
                    case 1:
                        _a.sent();
                        expect(queryByText("Create a " + name + " data source")).toBeNull();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=PluginDetails.test.js.map