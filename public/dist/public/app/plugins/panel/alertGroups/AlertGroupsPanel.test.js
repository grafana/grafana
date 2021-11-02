import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { Provider } from 'react-redux';
import { AlertGroupsPanel } from './AlertGroupsPanel';
import { setDataSourceSrv } from '@grafana/runtime';
import { byTestId } from 'testing-library-selector';
import { configureStore } from 'app/store/configureStore';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { fetchAlertGroups } from 'app/features/alerting/unified/api/alertmanager';
import { mockAlertGroup, mockAlertmanagerAlert, mockDataSource, MockDataSourceSrv, } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { render, waitFor } from '@testing-library/react';
jest.mock('app/features/alerting/unified/api/alertmanager');
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { config: __assign(__assign({}, jest.requireActual('@grafana/runtime').config), { buildInfo: {}, panels: {}, unifiedAlertingEnabled: true }) })); });
var mocks = {
    api: {
        fetchAlertGroups: typeAsJestMock(fetchAlertGroups),
    },
};
var dataSources = {
    am: mockDataSource({
        name: 'Alertmanager',
        type: DataSourceType.Alertmanager,
    }),
};
var defaultOptions = {
    labels: '',
    alertmanager: 'Alertmanager',
    expandAll: false,
};
var defaultProps = {
    data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
    id: 1,
    timeRange: getDefaultTimeRange(),
    timeZone: 'utc',
    options: defaultOptions,
    eventBus: {
        subscribe: jest.fn(),
        getStream: function () {
            return ({
                subscribe: jest.fn(),
            });
        },
        publish: jest.fn(),
        removeAllListeners: jest.fn(),
        newScopedBus: jest.fn(),
    },
    fieldConfig: {},
    height: 400,
    onChangeTimeRange: jest.fn(),
    onFieldConfigChange: jest.fn(),
    onOptionsChange: jest.fn(),
    renderCounter: 1,
    replaceVariables: jest.fn(),
    title: 'Alert groups test',
    transparent: false,
    width: 320,
};
var renderPanel = function (options) {
    if (options === void 0) { options = defaultOptions; }
    var store = configureStore();
    var dash = { id: 1, formatDate: function (time) { return new Date(time).toISOString(); } };
    var dashSrv = { getCurrent: function () { return dash; } };
    setDashboardSrv(dashSrv);
    defaultProps.options = options;
    var props = __assign({}, defaultProps);
    return render(React.createElement(Provider, { store: store },
        React.createElement(AlertGroupsPanel, __assign({}, props))));
};
var ui = {
    group: byTestId('alert-group'),
    alert: byTestId('alert-group-alert'),
};
describe('AlertGroupsPanel', function () {
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
    it('renders the panel with the groups', function () { return __awaiter(void 0, void 0, void 0, function () {
        var groups, alerts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, renderPanel()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlertGroups).toHaveBeenCalled(); })];
                case 2:
                    _a.sent();
                    groups = ui.group.getAll();
                    expect(groups).toHaveLength(2);
                    expect(groups[0]).toHaveTextContent('No grouping');
                    expect(groups[1]).toHaveTextContent('severity=warningregion=US-Central');
                    alerts = ui.alert.queryAll();
                    expect(alerts).toHaveLength(0);
                    return [2 /*return*/];
            }
        });
    }); });
    it('renders panel with groups expanded', function () { return __awaiter(void 0, void 0, void 0, function () {
        var alerts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, renderPanel({ labels: '', alertmanager: 'Alertmanager', expandAll: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlertGroups).toHaveBeenCalled(); })];
                case 2:
                    _a.sent();
                    alerts = ui.alert.queryAll();
                    expect(alerts).toHaveLength(3);
                    return [2 /*return*/];
            }
        });
    }); });
    it('filters alerts by label filter', function () { return __awaiter(void 0, void 0, void 0, function () {
        var alerts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, renderPanel({ labels: 'region=US-Central', alertmanager: 'Alertmanager', expandAll: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlertGroups).toHaveBeenCalled(); })];
                case 2:
                    _a.sent();
                    alerts = ui.alert.queryAll();
                    expect(alerts).toHaveLength(2);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=AlertGroupsPanel.test.js.map