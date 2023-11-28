import { __awaiter } from "tslib";
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { CheckService } from 'app/percona/check/Check.service';
import { logger } from 'app/percona/shared/helpers/logger';
import { configureStore } from 'app/store/configureStore';
import { FailedChecksTab } from './FailedChecksTab';
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
describe('FailedChecksTab::', () => {
    let getAlertsSpy = jest.spyOn(CheckService, 'getAllFailedChecks').mockImplementation(() => Promise.resolve([]));
    afterEach(() => getAlertsSpy.mockClear());
    it('should fetch active alerts at startup', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(FailedChecksTab, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(CheckService.getAllFailedChecks).toHaveBeenCalledTimes(1);
    }));
    it('should log an error if the fetch alerts API call fails', () => __awaiter(void 0, void 0, void 0, function* () {
        getAlertsSpy.mockImplementationOnce(() => {
            throw Error('test');
        });
        const loggerSpy = jest.spyOn(logger, 'error');
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(FailedChecksTab, null)));
        expect(loggerSpy).toBeCalledTimes(1);
        loggerSpy.mockClear();
    }));
    it('should render a table after having fetched the alerts', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
                },
            }) },
            React.createElement(FailedChecksTab, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(screen.queryByTestId('table-no-data')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=FailedChecksTab.test.js.map