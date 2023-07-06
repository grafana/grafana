import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';

import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import store from 'app/core/store';
import {
  AlertManagerCortexConfig,
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';

import {
  fetchAlertManagerConfig,
  deleteAlertManagerConfig,
  updateAlertManagerConfig,
  fetchStatus,
} from '../../api/alertmanager';
import {
  disableRBAC,
  mockDataSource,
  MockDataSourceSrv,
  someCloudAlertManagerConfig,
  someCloudAlertManagerStatus,
} from '../../mocks';
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

const renderAdminPage = (alertManagerSourceName?: string) => {
  locationService.push(
    '/alerting/notifications' +
      (alertManagerSourceName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${alertManagerSourceName}` : '')
  );

  return render(
    <TestProvider>
      <AlertmanagerProvider accessType="instance">
        <AlertmanagerConfig />
      </AlertmanagerProvider>
    </TestProvider>
  );
};

const dataSources = {
  alertManager: mockDataSource({
    name: 'CloudManager',
    type: DataSourceType.Alertmanager,
  }),
  promAlertManager: mockDataSource<AlertManagerDataSourceJsonData>({
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
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
    contextSrv.isGrafanaAdmin = true;
    store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
    disableRBAC();
  });

  it('Reset alertmanager config', async () => {
    mocks.api.fetchConfig.mockResolvedValue({
      template_files: {
        foo: 'bar',
      },
      alertmanager_config: {},
    });
    mocks.api.deleteAlertManagerConfig.mockResolvedValue();
    renderAdminPage(dataSources.alertManager.name);
    await userEvent.click(await ui.resetButton.find());
    await userEvent.click(ui.confirmButton.get());
    await waitFor(() => expect(mocks.api.deleteAlertManagerConfig).toHaveBeenCalled());
    expect(ui.confirmButton.query()).not.toBeInTheDocument();
  });

  it('Editable alertmanager config', async () => {
    let savedConfig: AlertManagerCortexConfig | undefined = undefined;

    const defaultConfig = {
      template_files: {},
      alertmanager_config: {
        route: {
          receiver: 'old one',
        },
      },
    };

    mocks.api.fetchConfig.mockImplementation(() => Promise.resolve(savedConfig ?? defaultConfig));
    mocks.api.updateAlertManagerConfig.mockResolvedValue();
    renderAdminPage(dataSources.alertManager.name);

    await ui.configInput.find();
    await userEvent.click(ui.saveButton.get());

    await waitFor(() => expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled());
    expect(mocks.api.updateAlertManagerConfig.mock.lastCall).toMatchSnapshot();

    await waitFor(() => expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(3));
  });

  it('Read-only when using Prometheus Alertmanager', async () => {
    mocks.api.fetchStatus.mockResolvedValue({
      ...someCloudAlertManagerStatus,
      config: someCloudAlertManagerConfig.alertmanager_config,
    });
    renderAdminPage(dataSources.promAlertManager.name);

    await ui.readOnlyConfig.find();
    expect(ui.resetButton.query()).not.toBeInTheDocument();
    expect(ui.saveButton.query()).not.toBeInTheDocument();

    expect(mocks.api.fetchConfig).not.toHaveBeenCalled();
    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
  });
});
