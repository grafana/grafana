import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { act } from 'react-test-renderer';
import { byRole, byText } from 'testing-library-selector';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { mockPromRulesApiResponse } from 'app/features/alerting/unified/mocks/alertRuleApi';
import { mockRulerRulesApiResponse } from 'app/features/alerting/unified/mocks/rulerApi';
import { Annotation } from 'app/features/alerting/unified/utils/constants';
import { setDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { contextSrv } from '../../../core/services/context_srv';
import { mockPromAlert, mockPromAlertingRule, mockPromRuleGroup, mockPromRuleNamespace, mockRulerGrafanaRule, mockUnifiedAlertingStore, } from '../../../features/alerting/unified/mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../features/alerting/unified/utils/datasource';
import { UnifiedAlertList } from './UnifiedAlertList';
import { GroupMode, SortOrder, ViewMode } from './types';
import * as utils from './util';
const grafanaRuleMock = {
    promRules: {
        grafana: {
            loading: false,
            dispatched: true,
            result: [
                mockPromRuleNamespace({
                    name: 'ns1',
                    groups: [
                        mockPromRuleGroup({
                            name: 'group1',
                            rules: [
                                mockPromAlertingRule({
                                    name: 'rule1',
                                    alerts: [mockPromAlert({ labels: { severity: 'critical' } })],
                                    totals: { alerting: 1 },
                                    totalsFiltered: { alerting: 1 },
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        },
    },
};
jest.mock('app/features/alerting/unified/api/alertmanager');
const fakeResponse = {
    data: { groups: grafanaRuleMock.promRules.grafana.result[0].groups },
    status: 'success',
};
const server = setupMswServer();
mockPromRulesApiResponse(server, fakeResponse);
const originRule = mockRulerGrafanaRule({
    for: '1m',
    labels: { severity: 'critical', region: 'nasa' },
    annotations: { [Annotation.summary]: 'This is a very important alert rule' },
}, { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [] });
mockRulerRulesApiResponse(server, 'grafana', {
    'folder-one': [{ name: 'group1', interval: '20s', rules: [originRule] }],
});
const defaultOptions = {
    maxItems: 2,
    sortOrder: SortOrder.AlphaAsc,
    dashboardAlerts: true,
    groupMode: GroupMode.Default,
    groupBy: [''],
    alertName: 'test',
    showInstances: false,
    folder: { id: 1, title: 'test folder' },
    stateFilter: { firing: true, pending: false, noData: false, normal: true, error: false },
    alertInstanceLabelFilter: '',
    datasource: 'grafana',
    viewMode: ViewMode.List,
};
const defaultProps = {
    data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
    id: 1,
    timeRange: getDefaultTimeRange(),
    timeZone: 'utc',
    options: defaultOptions,
    eventBus: {
        subscribe: jest.fn(),
        getStream: jest.fn(),
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
const dashboard = {
    id: 1,
    formatDate: (time) => new Date(time).toISOString(),
    events: {
        subscribe: jest.fn(),
    },
};
const renderPanel = (options = defaultOptions) => {
    const store = mockUnifiedAlertingStore(grafanaRuleMock);
    const dashSrv = { getCurrent: () => dashboard };
    setDashboardSrv(dashSrv);
    const props = Object.assign(Object.assign({}, defaultProps), { options: Object.assign(Object.assign({}, defaultOptions), options) });
    return render(React.createElement(Provider, { store: store },
        React.createElement(UnifiedAlertList, Object.assign({}, props))));
};
describe('UnifiedAlertList', () => {
    it('subscribes to the dashboard refresh interval', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(defaultProps, 'replaceVariables').mockReturnValue('severity=critical');
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            renderPanel();
        }));
        expect(dashboard.events.subscribe).toHaveBeenCalledTimes(1);
        expect(dashboard.events.subscribe.mock.calls[0][0]).toEqual(TimeRangeUpdatedEvent);
    }));
    it('should replace option variables before filtering', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
        const filterAlertsSpy = jest.spyOn(utils, 'filterAlerts');
        const replaceVarsSpy = jest.spyOn(defaultProps, 'replaceVariables').mockReturnValue('severity=critical');
        const user = userEvent.setup();
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            renderPanel({
                alertInstanceLabelFilter: '$label',
                dashboardAlerts: false,
                alertName: '',
                datasource: GRAFANA_RULES_SOURCE_NAME,
                folder: undefined,
            });
        }));
        yield waitFor(() => {
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        });
        expect(byText('rule1').get()).toBeInTheDocument();
        yield waitFor(() => {
            expect(screen.getByText('1 instance')).toBeInTheDocument();
        });
        const expandElement = byText('1 instance').get();
        yield user.click(expandElement);
        const labelsElement = yield byRole('list', { name: 'Labels' }).find();
        expect(yield byRole('listitem').find(labelsElement)).toHaveTextContent('severitycritical');
        expect(replaceVarsSpy).toHaveBeenLastCalledWith('$label');
        expect(filterAlertsSpy).toHaveBeenLastCalledWith(expect.objectContaining({
            alertInstanceLabelFilter: 'severity=critical',
        }), expect.anything());
    }));
});
//# sourceMappingURL=UnifiedalertList.test.js.map