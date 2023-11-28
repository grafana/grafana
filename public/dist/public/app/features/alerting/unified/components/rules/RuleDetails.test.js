import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { byRole } from 'testing-library-selector';
import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { getCloudRule, getGrafanaRule } from '../../mocks';
import { mockAlertmanagerChoiceResponse } from '../../mocks/alertmanagerApi';
import { RuleDetails } from './RuleDetails';
jest.mock('../../hooks/useIsRuleEditable');
const mocks = {
    useIsRuleEditable: jest.mocked(useIsRuleEditable),
};
const ui = {
    actionButtons: {
        edit: byRole('link', { name: /edit/i }),
        delete: byRole('button', { name: /delete/i }),
        silence: byRole('link', { name: 'Silence' }),
    },
};
const server = setupServer();
const alertmanagerChoiceMockedResponse = {
    alertmanagersChoice: AlertmanagerChoice.Internal,
    numExternalAlertmanagers: 0,
};
beforeAll(() => {
    setBackendSrv(backendSrv);
    server.listen({ onUnhandledRequest: 'error' });
    jest.clearAllMocks();
});
afterAll(() => {
    server.close();
});
beforeEach(() => {
    server.resetHandlers();
});
describe('RuleDetails RBAC', () => {
    describe('Grafana rules action buttons in details', () => {
        const grafanaRule = getGrafanaRule({ name: 'Grafana' });
        it('Should not render Edit button for users with the update permission', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
            // Act
            renderRuleDetails(grafanaRule);
            // Assert
            expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
            yield waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
        }));
        it('Should not render Delete button for users with the delete permission', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });
            // Act
            renderRuleDetails(grafanaRule);
            // Assert
            expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
            yield waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
        }));
        it('Should not render Silence button for users wihout the instance create permission', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
            mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
            // Act
            renderRuleDetails(grafanaRule);
            // Assert
            expect(ui.actionButtons.silence.query()).not.toBeInTheDocument();
            yield waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
        }));
        it('Should render Silence button for users with the instance create permissions', () => __awaiter(void 0, void 0, void 0, function* () {
            mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
            // Arrange
            jest
                .spyOn(contextSrv, 'hasPermission')
                .mockImplementation((action) => action === AccessControlAction.AlertingInstanceCreate);
            // Act
            renderRuleDetails(grafanaRule);
            // Assert
            expect(yield ui.actionButtons.silence.find()).toBeInTheDocument();
            yield waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
        }));
    });
    describe('Cloud rules action buttons', () => {
        const cloudRule = getCloudRule({ name: 'Cloud' });
        it('Should not render Edit button for users with the update permission', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            mocks.useIsRuleEditable.mockReturnValue({ loading: false, isEditable: true });
            // Act
            renderRuleDetails(cloudRule);
            // Assert
            expect(ui.actionButtons.edit.query()).not.toBeInTheDocument();
            yield waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
        }));
        it('Should not render Delete button for users with the delete permission', () => __awaiter(void 0, void 0, void 0, function* () {
            // Arrange
            mocks.useIsRuleEditable.mockReturnValue({ loading: false, isRemovable: true });
            // Act
            renderRuleDetails(cloudRule);
            // Assert
            expect(ui.actionButtons.delete.query()).not.toBeInTheDocument();
            yield waitFor(() => screen.queryByRole('button', { name: 'Declare incident' }));
        }));
    });
});
function renderRuleDetails(rule) {
    const store = configureStore();
    render(React.createElement(Provider, { store: store },
        React.createElement(MemoryRouter, null,
            React.createElement(RuleDetails, { rule: rule }))));
}
//# sourceMappingURL=RuleDetails.test.js.map