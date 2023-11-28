import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitForElementToBeRemoved, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import * as reducers from 'app/percona/shared/core/reducers';
import { configureStore } from 'app/store/configureStore';
import { SSHKey } from './SSHKey';
jest.mock('app/percona/settings/Settings.service');
describe('SSHKey::', () => {
    it('Renders correctly', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { sshKey: 'fake_key' } },
                },
            }) },
            React.createElement(SSHKey, null)));
        expect(screen.getByText('fake_key')).toBeInTheDocument();
    });
    it('Disables apply changes on initial values', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { sshKey: 'fake_key' } },
                },
            }) },
            React.createElement(SSHKey, null)));
        expect(screen.getByTestId('ssh-key-button')).toBeDisabled();
    });
    it('Calls apply changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const spy = jest.spyOn(reducers, 'updateSettingsAction');
        const { container } = render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { sshKey: 'fake_key' } },
                },
            }) },
            React.createElement(SSHKey, null)));
        fireEvent.change(screen.getByTestId('ssh-key'), { target: { value: 'new key' } });
        yield waitFor(() => expect(screen.getByTestId('ssh-key-button')).not.toBeDisabled());
        fireEvent.submit(screen.getByTestId('ssh-key-button'));
        yield waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));
        expect(spy).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=SSHKey.test.js.map