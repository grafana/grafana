import { __awaiter } from "tslib";
import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { byTestId } from 'testing-library-selector';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { fetchAlertGroups } from 'app/features/alerting/unified/api/alertmanager';
import { mockAlertGroup, mockAlertmanagerAlert, mockDataSource, MockDataSourceSrv, } from 'app/features/alerting/unified/mocks';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';
import { setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardModel } from 'app/features/dashboard/state';
import { configureStore } from 'app/store/configureStore';
import { AlertGroupsPanel } from './AlertGroupsPanel';
jest.mock('app/features/alerting/unified/api/alertmanager');
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { config: Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime').config), { buildInfo: {}, panels: {}, unifiedAlertingEnabled: true }) })));
const mocks = {
    api: {
        fetchAlertGroups: jest.mocked(fetchAlertGroups),
    },
};
const dataSources = {
    am: mockDataSource({
        name: 'Alertmanager',
        type: DataSourceType.Alertmanager,
    }),
};
const defaultOptions = {
    labels: '',
    alertmanager: 'Alertmanager',
    expandAll: false,
};
const defaultProps = {
    data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
    id: 1,
    timeRange: getDefaultTimeRange(),
    timeZone: 'utc',
    options: defaultOptions,
    eventBus: {
        subscribe: jest.fn(),
        getStream: jest.fn().mockReturnValue({
            subscribe: jest.fn(),
        }),
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
const renderPanel = (options = defaultOptions) => {
    const store = configureStore();
    const dash = new DashboardModel({ id: 1 });
    dash.formatDate = (time) => new Date(time).toISOString();
    const dashSrv = { getCurrent: () => dash };
    setDashboardSrv(dashSrv);
    defaultProps.options = options;
    const props = Object.assign({}, defaultProps);
    return render(React.createElement(Provider, { store: store },
        React.createElement(AlertGroupsPanel, Object.assign({}, props))));
};
const ui = {
    group: byTestId('alert-group'),
    alert: byTestId('alert-group-alert'),
};
describe('AlertGroupsPanel', () => {
    beforeAll(() => {
        mocks.api.fetchAlertGroups.mockImplementation(() => {
            return Promise.resolve([
                mockAlertGroup({ labels: {}, alerts: [mockAlertmanagerAlert({ labels: { foo: 'bar' } })] }),
                mockAlertGroup(),
            ]);
        });
    });
    beforeEach(() => {
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
    });
    it('renders the panel with the groups', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPanel();
        const groups = yield ui.group.findAll();
        expect(groups).toHaveLength(2);
        expect(groups[0]).toHaveTextContent('No grouping');
        expect(groups[1]).toHaveTextContent('severitywarning regionUS-Central');
        const alerts = ui.alert.queryAll();
        expect(alerts).toHaveLength(0);
    }));
    it('renders panel with groups expanded', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPanel({ labels: '', alertmanager: 'Alertmanager', expandAll: true });
        const alerts = yield ui.alert.findAll();
        expect(alerts).toHaveLength(3);
    }));
    it('filters alerts by label filter', () => __awaiter(void 0, void 0, void 0, function* () {
        renderPanel({ labels: 'region=US-Central', alertmanager: 'Alertmanager', expandAll: true });
        const alerts = yield ui.alert.findAll();
        expect(alerts).toHaveLength(2);
    }));
});
//# sourceMappingURL=AlertGroupsPanel.test.js.map