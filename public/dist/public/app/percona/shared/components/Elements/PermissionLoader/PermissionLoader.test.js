import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { PermissionLoader } from './PermissionLoader';
jest.mock('app/percona/settings/Settings.service');
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('PermissionLoader', () => {
    it('should render success if feature is enabled after loading', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
                },
            }) },
            React.createElement(PermissionLoader, { featureSelector: () => true, renderError: () => null, renderSuccess: () => React.createElement("span", { "data-testid": "dummy-child" }) })));
        expect(screen.getByTestId('dummy-child')).toBeInTheDocument();
    }));
    it('should show loading if feature disabled and while getting settings', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(Provider, { store: configureStore({ percona: { settings: { loading: true } } }) },
            React.createElement(PermissionLoader, { featureSelector: () => false, renderError: () => null, renderSuccess: () => React.createElement("span", { "data-testid": "dummy-child" }) })));
        expect(container.querySelector('.fa-spin')).toBeInTheDocument();
    }));
    it('should render error if feature disabled and user is authorized', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    settings: { loading: false },
                    user: { isAuthorized: true },
                },
            }) },
            React.createElement(PermissionLoader, { featureSelector: () => false, renderError: () => React.createElement("span", { "data-testid": "dummy-child" }), renderSuccess: () => null })));
        expect(screen.getByTestId('dummy-child')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=PermissionLoader.test.js.map