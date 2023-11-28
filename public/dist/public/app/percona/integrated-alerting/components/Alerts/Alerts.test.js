import { __awaiter } from "tslib";
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { contextSrv } from 'app/core/services/context_srv';
import { fetchSilences, fetchAlerts, createOrUpdateSilence } from 'app/features/alerting/unified/api/alertmanager';
import { mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { Alerts } from './Alerts';
jest.mock('app/features/alerting/unified/api/alertmanager');
jest.mock('app/core/services/context_srv');
const mocks = {
    api: {
        fetchSilences: jest.mocked(fetchSilences),
        fetchAlerts: jest.mocked(fetchAlerts),
        createOrUpdateSilence: jest.mocked(createOrUpdateSilence),
    },
    contextSrv: jest.mocked(contextSrv),
};
describe('AlertsTable', () => {
    beforeAll(() => {
        jest.resetAllMocks();
        mocks.api.fetchAlerts.mockImplementation(() => {
            return Promise.resolve([
                mockAlertmanagerAlert({
                    labels: { foo: 'bar' },
                    status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
                }),
                mockAlertmanagerAlert({
                    labels: { foo: 'buzz' },
                    status: { state: AlertState.Active, silencedBy: ['67890'], inhibitedBy: [] },
                }),
            ]);
        });
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('should render the table correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true },
                    settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
                },
            }) },
            React.createElement(Alerts, null)));
        yield waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
        expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
        expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=Alerts.test.js.map