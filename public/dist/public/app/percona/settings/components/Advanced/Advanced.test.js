import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import * as reducers from 'app/percona/shared/core/reducers';
import { configureStore } from 'app/store/configureStore';
import { Advanced } from './Advanced';
jest.mock('app/percona/settings/Settings.service');
describe('Advanced::', () => {
    it('Renders correctly with props', () => {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: {
                        loading: false,
                        result: {
                            sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                            dataRetention: '2592000s',
                            telemetryEnabled: true,
                            telemetrySummaries: ['summary1', 'summary2'],
                            updatesDisabled: true,
                            backupEnabled: false,
                            sttEnabled: true,
                            dbaasEnabled: false,
                            azureDiscoverEnabled: true,
                            publicAddress: 'localhost',
                            alertingEnabled: true,
                        },
                    },
                },
            }) },
            React.createElement(Advanced, null)));
        expect(screen.getByTestId('retention-number-input')).toHaveValue(30);
        expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('localhost');
    });
    it('Calls apply changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const spy = jest.spyOn(reducers, 'updateSettingsAction');
        const { container } = render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: {
                        loading: false,
                        result: {
                            sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                            dataRetention: '2592000s',
                            telemetryEnabled: true,
                            telemetrySummaries: ['summary1', 'summary2'],
                            updatesDisabled: true,
                            backupEnabled: false,
                            sttEnabled: true,
                            dbaasEnabled: false,
                            azureDiscoverEnabled: true,
                            publicAddress: 'localhost',
                            alertingEnabled: true,
                        },
                    },
                },
            }) },
            React.createElement(Advanced, null)));
        fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
        fireEvent.submit(screen.getByTestId('advanced-button'));
        yield waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));
        expect(spy).toHaveBeenCalled();
    }));
    it('Sets correct URL from browser', () => __awaiter(void 0, void 0, void 0, function* () {
        const location = Object.assign(Object.assign({}, window.location), { host: 'pmmtest.percona.com' });
        Object.defineProperty(window, 'location', {
            writable: true,
            value: location,
        });
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: {
                        loading: false,
                        result: {
                            sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                            dataRetention: '2592000s',
                            telemetryEnabled: true,
                            telemetrySummaries: ['summary1', 'summary2'],
                            updatesDisabled: true,
                            backupEnabled: false,
                            sttEnabled: true,
                            dbaasEnabled: false,
                            azureDiscoverEnabled: true,
                            publicAddress: 'localhost',
                            alertingEnabled: true,
                        },
                    },
                },
            }) },
            React.createElement(Advanced, null)));
        fireEvent.click(screen.getByTestId('public-address-button'));
        expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('pmmtest.percona.com');
    }));
    it('Does not include STT check intervals in the change request if STT checks are disabled', () => __awaiter(void 0, void 0, void 0, function* () {
        const spy = jest.spyOn(reducers, 'updateSettingsAction');
        const { container } = render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: {
                        loading: false,
                        result: {
                            sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                            dataRetention: '2592000s',
                            telemetryEnabled: true,
                            telemetrySummaries: ['summary1', 'summary2'],
                            updatesDisabled: true,
                            backupEnabled: false,
                            sttEnabled: false,
                            dbaasEnabled: false,
                            azureDiscoverEnabled: true,
                            publicAddress: 'localhost',
                            alertingEnabled: true,
                        },
                    },
                },
            }) },
            React.createElement(Advanced, null)));
        fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
        fireEvent.submit(screen.getByTestId('advanced-button'));
        yield waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));
        // expect(spy.calls.mostRecent().args[0].body.stt_check_intervals).toBeUndefined();
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ body: expect.objectContaining({ stt_check_intervals: undefined }) }));
    }));
    it('Includes STT check intervals in the change request if STT checks are enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        const spy = jest.spyOn(reducers, 'updateSettingsAction');
        const { container } = render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: {
                        loading: false,
                        result: {
                            sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                            dataRetention: '2592000s',
                            telemetryEnabled: true,
                            telemetrySummaries: ['summary1', 'summary2'],
                            updatesDisabled: true,
                            backupEnabled: false,
                            sttEnabled: true,
                            dbaasEnabled: false,
                            azureDiscoverEnabled: true,
                            publicAddress: 'localhost',
                            alertingEnabled: true,
                        },
                    },
                },
                navIndex: {},
            }) },
            React.createElement(Advanced, null)));
        fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
        fireEvent.submit(screen.getByTestId('advanced-button'));
        yield waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));
        // expect(spy.calls.mostRecent().args[0].body.stt_check_intervals).toBeDefined();
        expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ body: expect.objectContaining({ stt_check_intervals: expect.anything() }) }));
    }));
    it('Sets correct URL when DBaaS switched to checked mode', () => __awaiter(void 0, void 0, void 0, function* () {
        const location = Object.assign(Object.assign({}, window.location), { host: 'pmmtest.percona.com' });
        Object.defineProperty(window, 'location', {
            writable: true,
            value: location,
        });
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: {
                        loading: false,
                        result: {
                            sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                            dataRetention: '2592000s',
                            telemetryEnabled: true,
                            telemetrySummaries: ['summary1', 'summary2'],
                            updatesDisabled: true,
                            backupEnabled: false,
                            sttEnabled: true,
                            dbaasEnabled: false,
                            azureDiscoverEnabled: true,
                            publicAddress: '',
                            alertingEnabled: true,
                        },
                    },
                },
            }) },
            React.createElement(Advanced, null)));
        const input = screen.getByTestId('advanced-dbaas').querySelector('input');
        expect(input).not.toBeChecked();
        expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('');
        if (input) {
            fireEvent.click(input);
        }
        expect(input).toBeChecked();
        expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('pmmtest.percona.com');
    }));
});
//# sourceMappingURL=Advanced.test.js.map