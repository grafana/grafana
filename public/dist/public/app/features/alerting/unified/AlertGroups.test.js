import { __awaiter, __generator } from "tslib";
import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { fetchAlertGroups } from './api/alertmanager';
import { byRole, byTestId, byText } from 'testing-library-selector';
import { configureStore } from 'app/store/configureStore';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import AlertGroups from './AlertGroups';
import { mockAlertGroup, mockAlertmanagerAlert, mockDataSource, MockDataSourceSrv } from './mocks';
import { DataSourceType } from './utils/datasource';
import userEvent from '@testing-library/user-event';
jest.mock('./api/alertmanager');
var mocks = {
    api: {
        fetchAlertGroups: typeAsJestMock(fetchAlertGroups),
    },
};
var renderAmNotifications = function () {
    var store = configureStore();
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(AlertGroups, null))));
};
var dataSources = {
    am: mockDataSource({
        name: 'Alertmanager',
        type: DataSourceType.Alertmanager,
    }),
};
var ui = {
    group: byTestId('alert-group'),
    groupCollapseToggle: byTestId('alert-group-collapse-toggle'),
    groupTable: byTestId('alert-group-table'),
    row: byTestId('row'),
    collapseToggle: byTestId('collapse-toggle'),
    silenceButton: byText('Silence'),
    sourceButton: byText('See source'),
    matcherInput: byTestId('search-query-input'),
    groupByContainer: byTestId('group-by-container'),
    groupByInput: byRole('textbox', { name: /group by label keys/i }),
    clearButton: byRole('button', { name: 'Clear filters' }),
};
describe('AlertGroups', function () {
    beforeAll(function () {
        mocks.api.fetchAlertGroups.mockImplementation(function () {
            return Promise.resolve([
                mockAlertGroup({ labels: {}, alerts: [mockAlertmanagerAlert({ labels: { foo: 'bar' } })] }),
                mockAlertGroup(),
            ]);
        });
    });
    beforeEach(function () {
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
    });
    it('loads and shows groups', function () { return __awaiter(void 0, void 0, void 0, function () {
        var groups;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    renderAmNotifications();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlertGroups).toHaveBeenCalled(); })];
                case 1:
                    _a.sent();
                    groups = ui.group.getAll();
                    expect(groups).toHaveLength(2);
                    expect(groups[0]).toHaveTextContent('No grouping');
                    expect(groups[1]).toHaveTextContent('severity=warningregion=US-Central');
                    userEvent.click(ui.groupCollapseToggle.get(groups[0]));
                    expect(ui.groupTable.get()).toBeDefined();
                    userEvent.click(ui.collapseToggle.get(ui.groupTable.get()));
                    expect(ui.silenceButton.get(ui.groupTable.get())).toBeDefined();
                    expect(ui.sourceButton.get(ui.groupTable.get())).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    it('should group by custom grouping', function () { return __awaiter(void 0, void 0, void 0, function () {
        var regions, groups, groupByInput, groupByWrapper;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    regions = ['NASA', 'EMEA', 'APAC'];
                    mocks.api.fetchAlertGroups.mockImplementation(function () {
                        var groups = regions.map(function (region) {
                            return mockAlertGroup({
                                labels: { region: region },
                                alerts: [
                                    mockAlertmanagerAlert({ labels: { region: region, appName: 'billing', env: 'production' } }),
                                    mockAlertmanagerAlert({ labels: { region: region, appName: 'auth', env: 'staging', uniqueLabel: 'true' } }),
                                    mockAlertmanagerAlert({ labels: { region: region, appName: 'frontend', env: 'production' } }),
                                ],
                            });
                        });
                        return Promise.resolve(groups);
                    });
                    renderAmNotifications();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlertGroups).toHaveBeenCalled(); })];
                case 1:
                    _a.sent();
                    groups = ui.group.getAll();
                    groupByInput = ui.groupByInput.get();
                    groupByWrapper = ui.groupByContainer.get();
                    expect(groups).toHaveLength(3);
                    expect(groups[0]).toHaveTextContent('region=NASA');
                    expect(groups[1]).toHaveTextContent('region=EMEA');
                    expect(groups[2]).toHaveTextContent('region=APAC');
                    userEvent.type(groupByInput, 'appName{enter}');
                    return [4 /*yield*/, waitFor(function () { return expect(groupByWrapper).toHaveTextContent('appName'); })];
                case 2:
                    _a.sent();
                    groups = ui.group.getAll();
                    return [4 /*yield*/, waitFor(function () { return expect(ui.clearButton.get()).toBeInTheDocument(); })];
                case 3:
                    _a.sent();
                    expect(groups).toHaveLength(3);
                    expect(groups[0]).toHaveTextContent('appName=billing');
                    expect(groups[1]).toHaveTextContent('appName=auth');
                    expect(groups[2]).toHaveTextContent('appName=frontend');
                    userEvent.click(ui.clearButton.get());
                    return [4 /*yield*/, waitFor(function () { return expect(groupByWrapper).not.toHaveTextContent('appName'); })];
                case 4:
                    _a.sent();
                    userEvent.type(groupByInput, 'env{enter}');
                    return [4 /*yield*/, waitFor(function () { return expect(groupByWrapper).toHaveTextContent('env'); })];
                case 5:
                    _a.sent();
                    groups = ui.group.getAll();
                    expect(groups).toHaveLength(2);
                    expect(groups[0]).toHaveTextContent('env=production');
                    expect(groups[1]).toHaveTextContent('env=staging');
                    userEvent.click(ui.clearButton.get());
                    return [4 /*yield*/, waitFor(function () { return expect(groupByWrapper).not.toHaveTextContent('env'); })];
                case 6:
                    _a.sent();
                    userEvent.type(groupByInput, 'uniqueLabel{enter}');
                    return [4 /*yield*/, waitFor(function () { return expect(groupByWrapper).toHaveTextContent('uniqueLabel'); })];
                case 7:
                    _a.sent();
                    groups = ui.group.getAll();
                    expect(groups).toHaveLength(2);
                    expect(groups[0]).toHaveTextContent('No grouping');
                    expect(groups[1]).toHaveTextContent('uniqueLabel=true');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=AlertGroups.test.js.map