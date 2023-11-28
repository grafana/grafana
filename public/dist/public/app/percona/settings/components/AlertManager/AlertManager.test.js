import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import * as reducers from 'app/percona/shared/core/reducers';
import { configureStore } from 'app/store/configureStore';
import { AlertManager } from './AlertManager';
jest.mock('app/percona/settings/Settings.service');
describe('AlertManager::', () => {
    it('Renders correctly with props', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { alertManagerUrl: 'fake.url', alertManagerRules: 'rule' } },
                },
            }) },
            React.createElement(AlertManager, null)));
        expect(screen.getByDisplayValue('fake.url')).toBeInTheDocument();
        expect(screen.getByTestId('alertmanager-rules').textContent).toBe('rule');
    }));
    it('Disables apply changes on initial values', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { alertManagerUrl: 'fake.url', alertManagerRules: 'rule' } },
                },
            }) },
            React.createElement(AlertManager, null)));
        expect(screen.getByTestId('alertmanager-button')).toBeDisabled();
    });
    it('Calls apply changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const spy = jest.spyOn(reducers, 'updateSettingsAction');
        const { container } = render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { alertManagerUrl: 'fake.url', alertManagerRules: 'rule' } },
                },
            }) },
            React.createElement(AlertManager, null)));
        fireEvent.change(screen.getByTestId('alertmanager-rules'), { target: { value: 'new key' } });
        fireEvent.submit(screen.getByTestId('alertmanager-button'));
        yield waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));
        expect(spy).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=AlertManager.test.js.map