import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { byLabelText, byRole, byTestId } from 'testing-library-selector';

import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import store from 'app/core/store';
import {
  AlertManagerCortexConfig,
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';

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
  const store = configureStore();

  locationService.push(
    '/alerting/notifications' +
      (alertManagerSourceName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${alertManagerSourceName}` : '')
  );

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <AlertmanagerConfig />
      </Router>
    </Provider>
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
  confirmButton: byRole('button', { name: /Confirm Modal Danger Button/ }),
  resetButton: byRole('button', { name: /Reset configuration/ }),
  saveButton: byRole('button', { name: /Save/ }),
  configInput: byLabelText<HTMLTextAreaElement>(/Configuration/),
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

    await renderAdminPage(dataSources.alertManager.name);

    await userEvent.click(await ui.resetButton.find());
    await userEvent.click(ui.confirmButton.get());
    await waitFor(() => expect(mocks.api.deleteAlertManagerConfig).toHaveBeenCalled());
    expect(ui.confirmButton.query()).not.toBeInTheDocument();
  });

  it('Edit and save alertmanager config', async () => {
    let savedConfig: AlertManagerCortexConfig | undefined = undefined;

    const defaultConfig = {
      template_files: {
        foo: 'bar',
      },
      alertmanager_config: {},
    };

    const newConfig = {
      template_files: {
        bar: 'baz',
      },
      alertmanager_config: {},
    };

    mocks.api.fetchConfig.mockImplementation(() => Promise.resolve(savedConfig ?? defaultConfig));
    mocks.api.updateAlertManagerConfig.mockResolvedValue();
    await renderAdminPage(dataSources.alertManager.name);
    const input = await ui.configInput.find();
    expect(input.value).toEqual(JSON.stringify(defaultConfig, null, 2));
    await userEvent.clear(input);
    // What is this regex replace doing? in userEvent v13, '{' and '[' are special characters.
    // To get the literal character, you have to escape them by typing '{{' or '[['.
    // See https://github.com/testing-library/user-event/issues/584.
    await userEvent.type(input, JSON.stringify(newConfig, null, 2).replace(/[{[]/g, '$&$&'));
    await userEvent.click(ui.saveButton.get());
    await waitFor(() => expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled());
    await waitFor(() => expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(3));
    expect(input.value).toEqual(JSON.stringify(newConfig, null, 2));
  });

  it('Read-only when using Prometheus Alertmanager', async () => {
    mocks.api.fetchStatus.mockResolvedValue({
      ...someCloudAlertManagerStatus,
      config: someCloudAlertManagerConfig.alertmanager_config,
    });
    await renderAdminPage(dataSources.promAlertManager.name);

    await ui.readOnlyConfig.find();
    expect(ui.configInput.query()).not.toBeInTheDocument();
    expect(ui.resetButton.query()).not.toBeInTheDocument();
    expect(ui.saveButton.query()).not.toBeInTheDocument();

    expect(mocks.api.fetchConfig).not.toHaveBeenCalled();
    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
  });
});
