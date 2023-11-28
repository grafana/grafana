import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';
import 'whatwg-fetch';
import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { configureStore } from 'app/store/configureStore';
import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { mockAlertmanagerChoiceResponse } from '../mocks/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { GrafanaAlertmanagerDeliveryWarning } from './GrafanaAlertmanagerDeliveryWarning';
describe('GrafanaAlertmanagerDeliveryWarning', () => {
    const server = setupServer();
    beforeAll(() => {
        setBackendSrv(backendSrv);
        server.listen({ onUnhandledRequest: 'error' });
    });
    afterAll(() => {
        server.close();
    });
    beforeEach(() => {
        server.resetHandlers();
    });
    it('Should not render when the datasource is not Grafana', () => {
        mockAlertmanagerChoiceResponse(server, {
            alertmanagersChoice: AlertmanagerChoice.External,
            numExternalAlertmanagers: 0,
        });
        const { container } = renderWithStore(React.createElement(GrafanaAlertmanagerDeliveryWarning, { currentAlertmanager: "custom-alertmanager" }));
        expect(container).toBeEmptyDOMElement();
    });
    it('Should render warning when the datasource is Grafana and using external AM', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, {
            alertmanagersChoice: AlertmanagerChoice.External,
            numExternalAlertmanagers: 1,
        });
        renderWithStore(React.createElement(GrafanaAlertmanagerDeliveryWarning, { currentAlertmanager: GRAFANA_RULES_SOURCE_NAME }));
        expect(yield screen.findByText('Grafana alerts are not delivered to Grafana Alertmanager')).toBeVisible();
    }));
    it('Should render warning when the datasource is Grafana and using All AM', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, {
            alertmanagersChoice: AlertmanagerChoice.All,
            numExternalAlertmanagers: 1,
        });
        renderWithStore(React.createElement(GrafanaAlertmanagerDeliveryWarning, { currentAlertmanager: GRAFANA_RULES_SOURCE_NAME }));
        expect(yield screen.findByText('You have additional Alertmanagers to configure')).toBeVisible();
    }));
    it('Should render no warning when choice is Internal', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, {
            alertmanagersChoice: AlertmanagerChoice.Internal,
            numExternalAlertmanagers: 1,
        });
        const { container } = renderWithStore(React.createElement(GrafanaAlertmanagerDeliveryWarning, { currentAlertmanager: GRAFANA_RULES_SOURCE_NAME }));
        expect(container).toBeEmptyDOMElement();
    }));
    it('Should render no warning when choice is All but no active AM instances', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, {
            alertmanagersChoice: AlertmanagerChoice.All,
            numExternalAlertmanagers: 0,
        });
        const { container } = renderWithStore(React.createElement(GrafanaAlertmanagerDeliveryWarning, { currentAlertmanager: GRAFANA_RULES_SOURCE_NAME }));
        expect(container).toBeEmptyDOMElement();
    }));
});
function renderWithStore(element) {
    const store = configureStore();
    return render(React.createElement(Provider, { store: store }, element));
}
//# sourceMappingURL=GrafanaAlertmanagerDeliveryWarning.test.js.map