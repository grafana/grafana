import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { PlatformConnectedLoader } from '.';
describe('PlatformConnectedLoader', () => {
    it('should render error if user is not percona account and is connected to portal', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { loading: false, result: { isConnectedToPortal: true } },
                },
            }) },
            React.createElement(PlatformConnectedLoader, null)));
        expect(screen.getByTestId('not-platform-user')).toBeInTheDocument();
    }));
    it('should render error if user is not percona account and is not connected to portal and is not authorized', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: false, isPlatformUser: false },
                    settings: { loading: false, result: { isConnectedToPortal: false } },
                },
            }) },
            React.createElement(PlatformConnectedLoader, null)));
        expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
    }));
    it('should render error if user is not percona account and not connected to portal', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { loading: false, result: { isConnectedToPortal: false } },
                },
            }) },
            React.createElement(PlatformConnectedLoader, null)));
        expect(screen.getByTestId('not-connected-platform')).toBeInTheDocument();
    }));
    it('should render children when user is Percona account', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: true },
                    settings: { loading: false, result: { isConnectedToPortal: false } },
                },
            }) },
            React.createElement(PlatformConnectedLoader, null,
                React.createElement("div", { "data-testid": "dummy-child" }, "Test"))));
        expect(screen.getByTestId('dummy-child')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=PlatformConnectedLoader.test.js.map