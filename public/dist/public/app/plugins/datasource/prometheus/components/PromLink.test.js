import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { dateTime } from '@grafana/data';
import PromLink from './PromLink';
jest.mock('@grafana/data', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/data')), { rangeUtil: {
        intervalToSeconds: jest.fn(() => 15),
    } })));
const now = dateTime().valueOf();
const intervalInSeconds = 60 * 5;
const endInput = encodeURIComponent(dateTime(now).add(5, 'hours').format('Y-MM-DD HH:mm'));
const getPanelData = (panelDataOverrides) => {
    const panelData = {
        request: {
            scopedVars: [{ __interval: { text: '15s', value: '15s' } }],
            targets: [
                { refId: 'A', datasource: 'prom1' },
                { refId: 'B', datasource: 'prom2' },
            ],
            range: {
                raw: {},
                to: dateTime(now),
                from: dateTime(now - 1000 * intervalInSeconds), // 5 minutes ago from "now"
            },
        },
    };
    return Object.assign(panelData, panelDataOverrides);
};
const getDataSource = (datasourceOverrides) => {
    const datasource = {
        createQuery: () => ({ expr: 'up', step: 15 }),
        directUrl: 'prom1',
        getRateIntervalScopedVariable: jest.fn(() => ({ __rate_interval: { text: '60s', value: '60s' } })),
    };
    return Object.assign(datasource, datasourceOverrides);
};
const getDataSourceWithCustomQueryParameters = (datasourceOverrides) => {
    const datasource = {
        getPrometheusTime: () => 1677870470,
        createQuery: () => ({ expr: 'up', step: 20 }),
        directUrl: 'prom3',
        getRateIntervalScopedVariable: jest.fn(() => ({ __rate_interval: { text: '60s', value: '60s' } })),
        customQueryParameters: new URLSearchParams('g0.foo=1'),
    };
    return Object.assign(datasource, datasourceOverrides);
};
describe('PromLink', () => {
    it('should show correct link for 1 component', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement("div", null,
            React.createElement(PromLink, { datasource: getDataSource(), panelData: getPanelData(), query: {} })));
        expect(screen.getByText('Prometheus')).toHaveAttribute('href', `prom1/graph?g0.expr=up&g0.range_input=${intervalInSeconds}s&g0.end_input=${endInput}&g0.step_input=15&g0.tab=0`);
    }));
    it('should show different link when there are 2 components with the same panel data', () => {
        render(React.createElement("div", null,
            React.createElement(PromLink, { datasource: getDataSource(), panelData: getPanelData(), query: {} }),
            React.createElement(PromLink, { datasource: getDataSource({ directUrl: 'prom2' }), panelData: getPanelData(), query: {} })));
        const promLinkButtons = screen.getAllByText('Prometheus');
        expect(promLinkButtons[0]).toHaveAttribute('href', `prom1/graph?g0.expr=up&g0.range_input=${intervalInSeconds}s&g0.end_input=${endInput}&g0.step_input=15&g0.tab=0`);
        expect(promLinkButtons[1]).toHaveAttribute('href', `prom2/graph?g0.expr=up&g0.range_input=${intervalInSeconds}s&g0.end_input=${endInput}&g0.step_input=15&g0.tab=0`);
    });
    it('should create sanitized link', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement("div", null,
            React.createElement(PromLink, { datasource: getDataSource({ directUrl: "javascript:300?1:2;alert('Hello');//" }), panelData: getPanelData(), query: {} })));
        expect(screen.getByText('Prometheus')).toHaveAttribute('href', 'about:blank');
    }));
    it('should add custom query parameters when it is configured', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement("div", null,
            React.createElement(PromLink, { datasource: getDataSourceWithCustomQueryParameters(), panelData: getPanelData(), query: {} })));
        expect(screen.getByText('Prometheus')).toHaveAttribute('href', `prom3/graph?g0.foo=1&g0.expr=up&g0.range_input=${intervalInSeconds}s&g0.end_input=${endInput}&g0.step_input=20&g0.tab=0`);
    }));
});
//# sourceMappingURL=PromLink.test.js.map