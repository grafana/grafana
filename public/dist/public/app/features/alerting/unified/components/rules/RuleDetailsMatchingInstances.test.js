import { __awaiter } from "tslib";
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { times } from 'lodash';
import React from 'react';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';
import { GrafanaAlertState, PromAlertingRuleState } from '../../../../../types/unified-alerting-dto';
import { mockCombinedRule, mockDataSource, mockPromAlert, mockPromAlertingRule } from '../../mocks';
import { alertStateToReadable } from '../../utils/rules';
import { RuleDetailsMatchingInstances } from './RuleDetailsMatchingInstances';
const ui = {
    stateFilter: byTestId('alert-instance-state-filter'),
    stateButton: byRole('radio'),
    grafanaStateButton: {
        normal: byLabelText(/^Normal/),
        alerting: byLabelText(/^Alerting/),
        pending: byLabelText(/^Pending/),
        noData: byLabelText(/^NoData/),
        error: byLabelText(/^Error/),
    },
    cloudStateButton: {
        firing: byLabelText(/^Firing/),
        pending: byLabelText(/^Pending/),
    },
    instanceRow: byTestId('row'),
    showAllInstances: byTestId('show-all'),
};
describe('RuleDetailsMatchingInstances', () => {
    describe('Filtering', () => {
        it('For Grafana Managed rules instances filter should contain five states', () => {
            const rule = mockCombinedRule();
            render(React.createElement(RuleDetailsMatchingInstances, { rule: rule, enableFiltering: true }));
            const stateFilter = ui.stateFilter.get();
            expect(stateFilter).toBeInTheDocument();
            const stateButtons = ui.stateButton.getAll(stateFilter);
            expect(stateButtons).toHaveLength(5);
            expect(ui.grafanaStateButton.normal.get(stateFilter)).toBeInTheDocument();
            expect(ui.grafanaStateButton.alerting.get(stateFilter)).toBeInTheDocument();
            expect(ui.grafanaStateButton.pending.get(stateFilter)).toBeInTheDocument();
            expect(ui.grafanaStateButton.noData.get(stateFilter)).toBeInTheDocument();
            expect(ui.grafanaStateButton.error.get(stateFilter)).toBeInTheDocument();
        });
        it.each(Object.values(GrafanaAlertState))('Should filter grafana rules by %s state', (state) => __awaiter(void 0, void 0, void 0, function* () {
            const rule = mockCombinedRule({
                promRule: mockPromAlertingRule({
                    alerts: [
                        mockPromAlert({ state: GrafanaAlertState.Normal }),
                        mockPromAlert({ state: GrafanaAlertState.Alerting }),
                        mockPromAlert({ state: GrafanaAlertState.Pending }),
                        mockPromAlert({ state: GrafanaAlertState.NoData }),
                        mockPromAlert({ state: GrafanaAlertState.Error }),
                    ],
                }),
            });
            const buttons = {
                [GrafanaAlertState.Normal]: ui.grafanaStateButton.normal,
                [GrafanaAlertState.Alerting]: ui.grafanaStateButton.alerting,
                [GrafanaAlertState.Pending]: ui.grafanaStateButton.pending,
                [GrafanaAlertState.NoData]: ui.grafanaStateButton.noData,
                [GrafanaAlertState.Error]: ui.grafanaStateButton.error,
            };
            render(React.createElement(RuleDetailsMatchingInstances, { rule: rule, enableFiltering: true }));
            yield userEvent.click(buttons[state].get());
            expect(ui.instanceRow.getAll()).toHaveLength(1);
            expect(ui.instanceRow.get()).toHaveTextContent(alertStateToReadable(state));
        }));
        it('For Cloud rules instances filter should contain two states', () => {
            const rule = mockCombinedRule({
                namespace: mockPromNamespace(),
            });
            render(React.createElement(RuleDetailsMatchingInstances, { rule: rule, enableFiltering: true }));
            const stateFilter = ui.stateFilter.get();
            expect(stateFilter).toBeInTheDocument();
            const stateButtons = ui.stateButton.getAll(stateFilter);
            expect(stateButtons).toHaveLength(2);
            expect(ui.cloudStateButton.firing.get(stateFilter)).toBeInTheDocument();
            expect(ui.cloudStateButton.pending.get(stateFilter)).toBeInTheDocument();
        });
        it.each([PromAlertingRuleState.Pending, PromAlertingRuleState.Firing])('Should filter cloud rules by %s state', (state) => __awaiter(void 0, void 0, void 0, function* () {
            const rule = mockCombinedRule({
                namespace: mockPromNamespace(),
                promRule: mockPromAlertingRule({
                    alerts: [
                        mockPromAlert({ state: PromAlertingRuleState.Firing }),
                        mockPromAlert({ state: PromAlertingRuleState.Pending }),
                    ],
                }),
            });
            render(React.createElement(RuleDetailsMatchingInstances, { rule: rule, enableFiltering: true }));
            yield userEvent.click(ui.cloudStateButton[state].get());
            expect(ui.instanceRow.getAll()).toHaveLength(1);
            expect(ui.instanceRow.get()).toHaveTextContent(alertStateToReadable(state));
        }));
        it('should correctly filter instances', () => __awaiter(void 0, void 0, void 0, function* () {
            const event = userEvent.setup();
            const rule = mockCombinedRule({
                promRule: mockPromAlertingRule({
                    alerts: times(100, () => mockPromAlert({ state: GrafanaAlertState.Normal })),
                }),
                instanceTotals: {
                    inactive: 100,
                },
            });
            render(React.createElement(RuleDetailsMatchingInstances, { rule: rule, enableFiltering: true, pagination: { itemsPerPage: 10 } }));
            // should show all instances by default
            expect(ui.showAllInstances.query()).not.toBeInTheDocument();
            // filter by "error" state, should have no instances in that state
            yield event.click(ui.grafanaStateButton.error.get());
            // click "show all" instances
            yield event.click(ui.showAllInstances.get());
            expect(ui.showAllInstances.query()).not.toBeInTheDocument();
        }));
    });
});
function mockPromNamespace() {
    return {
        rulesSource: mockDataSource(),
        groups: [{ name: 'Prom rules group', rules: [], totals: {} }],
        name: 'Prometheus-test',
    };
}
//# sourceMappingURL=RuleDetailsMatchingInstances.test.js.map