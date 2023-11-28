import { __awaiter } from "tslib";
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import store from 'app/core/store';
import { AlertManagerImplementation, } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import { fetchAlertManagerConfig, deleteAlertManagerConfig, updateAlertManagerConfig, fetchStatus, } from '../../api/alertmanager';
import { grantUserPermissions, mockDataSource, MockDataSourceSrv, someCloudAlertManagerConfig, someCloudAlertManagerStatus, } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { getAllDataSources } from '../../utils/config';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../../utils/constants';
import { DataSourceType } from '../../utils/datasource';
import AlertmanagerConfig from './AlertmanagerConfig';
jest.mock('../../api/alertmanager');
jest.mock('../../api/grafana');
jest.mock('../../utils/config');
const mocks = {
    getAllDataSources: jest.mocked(getAllDataSources),
    api: {
        fetchConfig: jest.mocked(fetchAlertManagerConfig),
        deleteAlertManagerConfig: jest.mocked(deleteAlertManagerConfig),
        updateAlertManagerConfig: jest.mocked(updateAlertManagerConfig),
        fetchStatus: jest.mocked(fetchStatus),
    },
};
const renderAdminPage = (alertManagerSourceName) => {
    locationService.push('/alerting/notifications' +
        (alertManagerSourceName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${alertManagerSourceName}` : ''));
    return render(React.createElement(TestProvider, null,
        React.createElement(AlertmanagerProvider, { accessType: "instance" },
            React.createElement(AlertmanagerConfig, null))));
};
const dataSources = {
    alertManager: mockDataSource({
        name: 'CloudManager',
        type: DataSourceType.Alertmanager,
    }),
    promAlertManager: mockDataSource({
        name: 'PromManager',
        type: DataSourceType.Alertmanager,
        jsonData: {
            implementation: AlertManagerImplementation.prometheus,
        },
    }),
};
const ui = {
    confirmButton: byRole('button', { name: /Yes, reset configuration/ }),
    resetButton: byRole('button', { name: /Reset configuration/ }),
    saveButton: byRole('button', { name: /Save/ }),
    configInput: byLabelText(/Code editor container/),
    readOnlyConfig: byTestId('readonly-config'),
};
describe('Admin config', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        // FIXME: scope down
        grantUserPermissions(Object.values(AccessControlAction));
        mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
        contextSrv.isGrafanaAdmin = true;
        store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
    });
    it('Reset alertmanager config', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.fetchConfig.mockResolvedValue({
            template_files: {
                foo: 'bar',
            },
            alertmanager_config: {},
        });
        mocks.api.deleteAlertManagerConfig.mockResolvedValue();
        renderAdminPage(dataSources.alertManager.name);
        yield userEvent.click(yield ui.resetButton.find());
        yield userEvent.click(ui.confirmButton.get());
        yield waitFor(() => expect(mocks.api.deleteAlertManagerConfig).toHaveBeenCalled());
        expect(ui.confirmButton.query()).not.toBeInTheDocument();
    }));
    it('Editable alertmanager config', () => __awaiter(void 0, void 0, void 0, function* () {
        let savedConfig = undefined;
        const defaultConfig = {
            template_files: {},
            alertmanager_config: {
                route: {
                    receiver: 'old one',
                },
            },
        };
        mocks.api.fetchConfig.mockImplementation(() => Promise.resolve(savedConfig !== null && savedConfig !== void 0 ? savedConfig : defaultConfig));
        mocks.api.updateAlertManagerConfig.mockResolvedValue();
        renderAdminPage(dataSources.alertManager.name);
        yield ui.configInput.find();
        yield userEvent.click(ui.saveButton.get());
        yield waitFor(() => expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled());
        expect(mocks.api.updateAlertManagerConfig.mock.lastCall).toMatchSnapshot();
        yield waitFor(() => expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(2));
    }));
    it('Read-only when using Prometheus Alertmanager', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.fetchStatus.mockResolvedValue(Object.assign(Object.assign({}, someCloudAlertManagerStatus), { config: someCloudAlertManagerConfig.alertmanager_config }));
        renderAdminPage(dataSources.promAlertManager.name);
        yield ui.readOnlyConfig.find();
        expect(ui.resetButton.query()).not.toBeInTheDocument();
        expect(ui.saveButton.query()).not.toBeInTheDocument();
        expect(mocks.api.fetchConfig).not.toHaveBeenCalled();
        expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
    }));
});
//# sourceMappingURL=AlertmanagerConfig.test.js.map