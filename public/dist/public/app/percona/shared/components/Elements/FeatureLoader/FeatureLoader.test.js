import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { FeatureLoader } from './FeatureLoader';
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('FeatureLoader', () => {
    it('should not have children while loading settings', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: true, result: { isConnectedToPortal: true, alertingEnabled: true } },
                },
            }) },
            React.createElement(FeatureLoader, { featureName: "IA", featureSelector: (state) => { var _a; return !!((_a = state.percona.settings.result) === null || _a === void 0 ? void 0 : _a.alertingEnabled); } },
                React.createElement("span", null, "Dummy"))));
        expect(container.querySelector('.fa-spin')).toBeInTheDocument();
        expect(screen.queryByText('Dummy')).not.toBeInTheDocument();
    }));
    it('should show children after loading settings', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
                },
            }) },
            React.createElement(FeatureLoader, { featureName: "IA", featureSelector: (state) => { var _a; return !!((_a = state.percona.settings.result) === null || _a === void 0 ? void 0 : _a.alertingEnabled); } },
                React.createElement("span", null, "Dummy"))));
        expect(screen.getByText('Dummy')).toBeInTheDocument();
    }));
    it('should show insufficient access permissions message', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: false },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: false } },
                },
            }) },
            React.createElement(FeatureLoader, { featureName: "IA", featureSelector: (state) => { var _a; return !!((_a = state.percona.settings.result) === null || _a === void 0 ? void 0 : _a.alertingEnabled); } },
                React.createElement("span", null, "Dummy"))));
        expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
    }));
    it('should show a disabled feature message ', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: false } },
                },
            }) },
            React.createElement(FeatureLoader, { featureName: "IA", featureSelector: (state) => { var _a; return !!((_a = state.percona.settings.result) === null || _a === void 0 ? void 0 : _a.alertingEnabled); } },
                React.createElement("span", null, "Dummy"))));
        expect(screen.getByTestId('settings-link')).toBeInTheDocument();
    }));
    it('should show a generic disabled message when feature name is not passed', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: false } },
                },
            }) },
            React.createElement(FeatureLoader, { featureSelector: (state) => { var _a; return !!((_a = state.percona.settings.result) === null || _a === void 0 ? void 0 : _a.alertingEnabled); } },
                React.createElement("span", null, "Dummy"))));
        expect(screen.queryByTestId('settings-link')).not.toBeInTheDocument();
        expect(screen.getByText('Feature is disabled.')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=FeatureLoader.test.js.map