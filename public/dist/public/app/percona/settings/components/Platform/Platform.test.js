import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { Platform } from './Platform';
describe('Platform::', () => {
    it('shows form to connect if not connected', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: false } },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(Platform, null))));
        expect(screen.getByTestId('connect-form')).toBeInTheDocument();
    });
    it('shows connected message if connected', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true } },
                },
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(Platform, null))));
        expect(screen.getByTestId('connected-wrapper')).toBeInTheDocument();
    });
});
//# sourceMappingURL=Platform.test.js.map