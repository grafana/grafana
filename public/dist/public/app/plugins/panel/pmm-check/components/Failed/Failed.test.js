import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { CheckService } from 'app/percona/check/Check.service';
import { configureStore } from 'app/store/configureStore';
import { Failed } from './Failed';
jest.mock('app/percona/check/Check.service');
describe('Failed::', () => {
    it('should render a sum of total failed checks with severity details', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(CheckService, 'getAllFailedChecks').mockImplementationOnce(() => __awaiter(void 0, void 0, void 0, function* () {
            return [
                {
                    serviceName: '',
                    serviceId: '',
                    counts: {
                        emergency: 0,
                        critical: 1,
                        alert: 0,
                        error: 0,
                        warning: 2,
                        notice: 0,
                        info: 0,
                        debug: 0,
                    },
                },
                {
                    serviceName: '',
                    serviceId: '',
                    counts: {
                        emergency: 0,
                        critical: 2,
                        alert: 0,
                        error: 0,
                        warning: 0,
                        notice: 0,
                        info: 0,
                        debug: 0,
                    },
                },
            ];
        }));
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { sttEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(Failed, null)));
        yield waitFor(() => expect(screen.getByTestId('db-check-panel-critical').textContent).toEqual('3'));
        yield waitFor(() => expect(screen.getByTestId('db-check-panel-error').textContent).toEqual('0'));
        yield waitFor(() => expect(screen.getByTestId('db-check-panel-warning').textContent).toEqual('2'));
        yield waitFor(() => expect(screen.getByTestId('db-check-panel-notice').textContent).toEqual('0'));
    }));
    it('should render 0 when the sum of all checks is zero', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(CheckService, 'getAllFailedChecks').mockImplementationOnce(() => __awaiter(void 0, void 0, void 0, function* () {
            return [
                {
                    serviceName: '',
                    serviceId: '',
                    counts: {
                        emergency: 0,
                        critical: 0,
                        alert: 0,
                        error: 0,
                        warning: 0,
                        notice: 0,
                        info: 0,
                        debug: 0,
                    },
                },
                {
                    serviceName: '',
                    serviceId: '',
                    counts: {
                        emergency: 0,
                        critical: 0,
                        alert: 0,
                        error: 0,
                        warning: 0,
                        notice: 0,
                        info: 0,
                        debug: 0,
                    },
                },
            ];
        }));
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { sttEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(Failed, null)));
        yield waitFor(() => expect(screen.getByTestId('db-check-panel-zero-checks')).toBeInTheDocument());
    }));
    it('should render a message when the user only has reader access', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: false },
                    settings: { loading: false, result: { sttEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(Failed, null)));
        yield waitFor(() => expect(screen.getByTestId('unauthorized')).toBeInTheDocument());
    }));
});
//# sourceMappingURL=Failed.test.js.map