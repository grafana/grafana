import { __awaiter } from "tslib";
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { byRole } from 'testing-library-selector';
import { locationService, logInfo } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { LogMessages } from '../../Analytics';
import { mockCombinedRule, mockDataSource } from '../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { RuleListGroupView } from './RuleListGroupView';
jest.mock('@grafana/runtime', () => {
    const original = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, original), { logInfo: jest.fn() });
});
const ui = {
    grafanaRulesHeading: byRole('heading', { name: 'Grafana' }),
    cloudRulesHeading: byRole('heading', { name: 'Mimir / Cortex / Loki' }),
};
describe('RuleListGroupView', () => {
    describe('RBAC', () => {
        it('Should display Grafana rules when the user has the alert rule read permission', () => __awaiter(void 0, void 0, void 0, function* () {
            const grafanaNamespace = getGrafanaNamespace();
            const namespaces = [grafanaNamespace];
            jest
                .spyOn(contextSrv, 'hasPermission')
                .mockImplementation((action) => action === AccessControlAction.AlertingRuleRead);
            renderRuleList(namespaces);
            yield waitFor(() => {
                expect(ui.grafanaRulesHeading.get()).toBeInTheDocument();
            });
        }));
        it('Should display Cloud rules when the user has the external rules read permission', () => __awaiter(void 0, void 0, void 0, function* () {
            const cloudNamespace = getCloudNamespace();
            const namespaces = [cloudNamespace];
            jest
                .spyOn(contextSrv, 'hasPermission')
                .mockImplementation((action) => action === AccessControlAction.AlertingRuleExternalRead);
            renderRuleList(namespaces);
            yield waitFor(() => {
                expect(ui.cloudRulesHeading.get()).toBeInTheDocument();
            });
        }));
        it('Should not display Grafana rules when the user does not have alert rule read permission', () => __awaiter(void 0, void 0, void 0, function* () {
            const grafanaNamespace = getGrafanaNamespace();
            const namespaces = [grafanaNamespace];
            jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
            renderRuleList(namespaces);
            yield waitFor(() => {
                expect(ui.grafanaRulesHeading.query()).not.toBeInTheDocument();
            });
        }));
        it('Should not display Cloud rules when the user does not have the external rules read permission', () => __awaiter(void 0, void 0, void 0, function* () {
            const cloudNamespace = getCloudNamespace();
            const namespaces = [cloudNamespace];
            renderRuleList(namespaces);
            jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
            renderRuleList(namespaces);
            yield waitFor(() => {
                expect(ui.cloudRulesHeading.query()).not.toBeInTheDocument();
            });
        }));
    });
    describe('Analytics', () => {
        it('Sends log info when the list is loaded', () => {
            const grafanaNamespace = getGrafanaNamespace();
            const namespaces = [grafanaNamespace];
            renderRuleList(namespaces);
            expect(logInfo).toHaveBeenCalledWith(LogMessages.loadedList);
        });
    });
});
function renderRuleList(namespaces) {
    const store = configureStore();
    render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(RuleListGroupView, { namespaces: namespaces, expandAll: true }))));
}
function getGrafanaNamespace() {
    return {
        name: 'Grafana Test Namespace',
        rulesSource: GRAFANA_RULES_SOURCE_NAME,
        groups: [
            {
                name: 'default',
                rules: [mockCombinedRule()],
                totals: {},
            },
        ],
    };
}
function getCloudNamespace() {
    return {
        name: 'Cloud Test Namespace',
        rulesSource: mockDataSource(),
        groups: [
            {
                name: 'Prom group',
                rules: [mockCombinedRule()],
                totals: {},
            },
        ],
    };
}
//# sourceMappingURL=RuleListGroupView.test.js.map