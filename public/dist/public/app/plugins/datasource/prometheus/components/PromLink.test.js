import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import PromLink from './PromLink';
jest.mock('@grafana/data', function () { return (__assign(__assign({}, jest.requireActual('@grafana/data')), { rangeUtil: {
        intervalToSeconds: jest.fn(function () { return 15; }),
    } })); });
var getPanelData = function (panelDataOverrides) {
    var panelData = {
        request: {
            scopedVars: [{ __interval: { text: '15s', value: '15s' } }],
            targets: [
                { refId: 'A', datasource: 'prom1' },
                { refId: 'B', datasource: 'prom2' },
            ],
            range: {
                to: {
                    utc: function () { return ({
                        format: jest.fn(),
                    }); },
                },
            },
        },
    };
    return Object.assign(panelData, panelDataOverrides);
};
var getDataSource = function (datasourceOverrides) {
    var datasource = {
        getPrometheusTime: function () { return 123; },
        createQuery: function () { return ({ expr: 'up', step: 15 }); },
        directUrl: 'prom1',
        getRateIntervalScopedVariable: jest.fn(function () { return ({ __rate_interval: { text: '60s', value: '60s' } }); }),
    };
    return Object.assign(datasource, datasourceOverrides);
};
describe('PromLink', function () {
    it('should show correct link for 1 component', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            render(React.createElement("div", null,
                React.createElement(PromLink, { datasource: getDataSource(), panelData: getPanelData(), query: {} })));
            expect(screen.getByText('Prometheus')).toHaveAttribute('href', 'prom1/graph?g0.expr=up&g0.range_input=0s&g0.end_input=undefined&g0.step_input=15&g0.tab=0');
            return [2 /*return*/];
        });
    }); });
    it('should show different link when there are 2 components with the same panel data', function () {
        render(React.createElement("div", null,
            React.createElement(PromLink, { datasource: getDataSource(), panelData: getPanelData(), query: {} }),
            React.createElement(PromLink, { datasource: getDataSource({ directUrl: 'prom2' }), panelData: getPanelData(), query: {} })));
        var promLinkButtons = screen.getAllByText('Prometheus');
        expect(promLinkButtons[0]).toHaveAttribute('href', 'prom1/graph?g0.expr=up&g0.range_input=0s&g0.end_input=undefined&g0.step_input=15&g0.tab=0');
        expect(promLinkButtons[1]).toHaveAttribute('href', 'prom2/graph?g0.expr=up&g0.range_input=0s&g0.end_input=undefined&g0.step_input=15&g0.tab=0');
    });
    it('should create sanitized link', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            render(React.createElement("div", null,
                React.createElement(PromLink, { datasource: getDataSource({ directUrl: "javascript:300?1:2;alert('Hello');//" }), panelData: getPanelData(), query: {} })));
            expect(screen.getByText('Prometheus')).toHaveAttribute('href', 'about:blank');
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=PromLink.test.js.map