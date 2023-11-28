import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { PlatformService } from '../Platform.service';
import { Connected } from './Connected';
import { Messages } from './Connected.messages';
jest.mock('app/percona/settings/components/Platform/Platform.service');
jest.mock('app/percona/settings/Settings.service');
describe('Connected:', () => {
    it('render connected message', () => {
        var _a;
        render(React.createElement(Provider, { store: configureStore() },
            React.createElement(Connected, null)));
        const wrapper = screen.getByTestId('connected-wrapper');
        expect(wrapper).toBeInTheDocument();
        expect((_a = wrapper.textContent) === null || _a === void 0 ? void 0 : _a.includes(Messages.connected)).toBeTruthy();
    });
    it('should render disconnect modal for platform users', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: true },
                    settings: { result: { isConnectedToPortal: true } },
                },
            }) },
            React.createElement(Connected, null)));
        fireEvent.click(screen.getByTestId('disconnect-button'));
        expect(screen.getByText(Messages.modalTitle)).toBeInTheDocument();
    }));
    it('should disconnect when confirming in modal', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.useFakeTimers();
        const disconnectSpy = jest.spyOn(PlatformService, 'disconnect').mockResolvedValueOnce();
        const locationSpy = jest.fn();
        const location = Object.assign(Object.assign({}, window.location), { assign: locationSpy });
        Object.defineProperty(window, 'location', {
            writable: true,
            configurable: true,
            value: location,
        });
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: true },
                    settings: { result: { isConnectedToPortal: true } },
                },
            }) },
            React.createElement(Connected, null)));
        fireEvent.click(screen.getByTestId('disconnect-button'));
        yield waitFor(() => screen.getByText(Messages.modalTitle));
        const confirmButton = screen
            .getAllByRole('button')
            .find((button) => button.getAttribute('aria-label') === 'Confirm Modal Danger Button');
        fireEvent.click(confirmButton);
        yield Promise.resolve();
        expect(disconnectSpy).toHaveBeenCalled();
    }));
    it('should render force-disconnect modal for non platform users', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { isConnectedToPortal: true } },
                },
            }) },
            React.createElement(Connected, null)));
        fireEvent.click(screen.getByTestId('disconnect-button'));
        expect(screen.getByTestId('force-disconnect-modal')).toBeInTheDocument();
    }));
    it('should force disconnect for non percona platform users', () => __awaiter(void 0, void 0, void 0, function* () {
        const forceDisconnectSpy = jest.spyOn(PlatformService, 'forceDisconnect').mockResolvedValueOnce();
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { isConnectedToPortal: true } },
                },
            }) },
            React.createElement(Connected, null)));
        fireEvent.click(screen.getByTestId('disconnect-button'));
        yield waitFor(() => screen.getByTestId('force-disconnect-modal'));
        const confirmButton = screen
            .getAllByRole('button')
            .find((button) => button.getAttribute('aria-label') === 'Confirm Modal Danger Button');
        fireEvent.click(confirmButton);
        yield waitFor(() => expect(forceDisconnectSpy).toHaveBeenCalled());
    }));
});
//# sourceMappingURL=Connected.test.js.map