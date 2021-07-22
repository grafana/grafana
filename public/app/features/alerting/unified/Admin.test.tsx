import React from 'react';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchAlertManagerConfig, deleteAlertManagerConfig } from './api/alertmanager';
import { configureStore } from 'app/store/configureStore';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import Admin from './Admin';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from './utils/constants';
import { render, waitFor } from '@testing-library/react';
import { byRole } from 'testing-library-selector';
import { mockDataSource, MockDataSourceSrv } from './mocks';
import { DataSourceType } from './utils/datasource';
import { contextSrv } from 'app/core/services/context_srv';
import store from 'app/core/store';
import userEvent from '@testing-library/user-event';

jest.mock('./api/alertmanager');
jest.mock('./api/grafana');
jest.mock('./utils/config');

const mocks = {
  getAllDataSources: typeAsJestMock(getAllDataSources),

  api: {
    fetchConfig: typeAsJestMock(fetchAlertManagerConfig),
    deleteAlertManagerConfig: typeAsJestMock(deleteAlertManagerConfig),
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
        <Admin />
      </Router>
    </Provider>
  );
};

const dataSources = {
  alertManager: mockDataSource({
    name: 'CloudManager',
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  confirmButton: byRole('button', { name: /Confirm Modal Danger Button/ }),
  resetButton: byRole('button', { name: /Reset Alertmanager configuration/ }),
};

describe('Alerting Admin', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
    contextSrv.isGrafanaAdmin = true;
    store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
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

    userEvent.click(await ui.resetButton.find());
    userEvent.click(ui.confirmButton.get());
    await waitFor(() => expect(mocks.api.deleteAlertManagerConfig).toHaveBeenCalled());
    expect(ui.confirmButton.query()).not.toBeInTheDocument();
  });
});
