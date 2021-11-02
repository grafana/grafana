import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchAlertManagerConfig, deleteAlertManagerConfig, updateAlertManagerConfig, fetchStatus, } from './api/alertmanager';
import { configureStore } from 'app/store/configureStore';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import Admin from './Admin';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from './utils/constants';
import { render, waitFor } from '@testing-library/react';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';
import { mockDataSource, MockDataSourceSrv, someCloudAlertManagerConfig, someCloudAlertManagerStatus } from './mocks';
import { DataSourceType } from './utils/datasource';
import { contextSrv } from 'app/core/services/context_srv';
import store from 'app/core/store';
import userEvent from '@testing-library/user-event';
import { AlertManagerImplementation, } from 'app/plugins/datasource/alertmanager/types';
jest.mock('./api/alertmanager');
jest.mock('./api/grafana');
jest.mock('./utils/config');
var mocks = {
    getAllDataSources: typeAsJestMock(getAllDataSources),
    api: {
        fetchConfig: typeAsJestMock(fetchAlertManagerConfig),
        deleteAlertManagerConfig: typeAsJestMock(deleteAlertManagerConfig),
        updateAlertManagerConfig: typeAsJestMock(updateAlertManagerConfig),
        fetchStatus: typeAsJestMock(fetchStatus),
    },
};
var renderAdminPage = function (alertManagerSourceName) {
    var store = configureStore();
    locationService.push('/alerting/notifications' +
        (alertManagerSourceName ? "?" + ALERTMANAGER_NAME_QUERY_KEY + "=" + alertManagerSourceName : ''));
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(Admin, null))));
};
var dataSources = {
    alertManager: mockDataSource({
        name: 'CloudManager',
        type: DataSourceType.Alertmanager,
    }),
    promAlertManager: mockDataSource({
        name: 'PromManager',
        type: DataSourceType.Alertmanager,
        jsonData: {
            implementation: AlertManagerImplementation.prometheus,
        },
    }),
};
var ui = {
    confirmButton: byRole('button', { name: /Confirm Modal Danger Button/ }),
    resetButton: byRole('button', { name: /Reset configuration/ }),
    saveButton: byRole('button', { name: /Save/ }),
    configInput: byLabelText(/Configuration/),
    readOnlyConfig: byTestId('readonly-config'),
};
describe('Alerting Admin', function () {
    beforeEach(function () {
        jest.resetAllMocks();
        mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
        contextSrv.isGrafanaAdmin = true;
        store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
    });
    it('Reset alertmanager config', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    mocks.api.fetchConfig.mockResolvedValue({
                        template_files: {
                            foo: 'bar',
                        },
                        alertmanager_config: {},
                    });
                    mocks.api.deleteAlertManagerConfig.mockResolvedValue();
                    return [4 /*yield*/, renderAdminPage(dataSources.alertManager.name)];
                case 1:
                    _c.sent();
                    _b = (_a = userEvent).click;
                    return [4 /*yield*/, ui.resetButton.find()];
                case 2:
                    _b.apply(_a, [_c.sent()]);
                    userEvent.click(ui.confirmButton.get());
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.deleteAlertManagerConfig).toHaveBeenCalled(); })];
                case 3:
                    _c.sent();
                    expect(ui.confirmButton.query()).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('Edit and save alertmanager config', function () { return __awaiter(void 0, void 0, void 0, function () {
        var savedConfig, defaultConfig, newConfig, input;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    savedConfig = undefined;
                    defaultConfig = {
                        template_files: {
                            foo: 'bar',
                        },
                        alertmanager_config: {},
                    };
                    newConfig = {
                        template_files: {
                            bar: 'baz',
                        },
                        alertmanager_config: {},
                    };
                    mocks.api.fetchConfig.mockImplementation(function () { return Promise.resolve(savedConfig !== null && savedConfig !== void 0 ? savedConfig : defaultConfig); });
                    mocks.api.updateAlertManagerConfig.mockResolvedValue();
                    return [4 /*yield*/, renderAdminPage(dataSources.alertManager.name)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.configInput.find()];
                case 2:
                    input = _a.sent();
                    expect(input.value).toEqual(JSON.stringify(defaultConfig, null, 2));
                    userEvent.clear(input);
                    // What is this regex replace doing? in userEvent v13, '{' and '[' are special characters.
                    // To get the literal character, you have to escape them by typing '{{' or '[['.
                    // See https://github.com/testing-library/user-event/issues/584.
                    userEvent.type(input, JSON.stringify(newConfig, null, 2).replace(/[{[]/g, '$&$&'));
                    userEvent.click(ui.saveButton.get());
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled(); })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(3); })];
                case 4:
                    _a.sent();
                    expect(input.value).toEqual(JSON.stringify(newConfig, null, 2));
                    return [2 /*return*/];
            }
        });
    }); });
    it('Read-only when using Prometheus Alertmanager', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.api.fetchStatus.mockResolvedValue(__assign(__assign({}, someCloudAlertManagerStatus), { config: someCloudAlertManagerConfig.alertmanager_config }));
                    return [4 /*yield*/, renderAdminPage(dataSources.promAlertManager.name)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.readOnlyConfig.find()];
                case 2:
                    _a.sent();
                    expect(ui.configInput.query()).not.toBeInTheDocument();
                    expect(ui.resetButton.query()).not.toBeInTheDocument();
                    expect(ui.saveButton.query()).not.toBeInTheDocument();
                    expect(mocks.api.fetchConfig).not.toHaveBeenCalled();
                    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=Admin.test.js.map