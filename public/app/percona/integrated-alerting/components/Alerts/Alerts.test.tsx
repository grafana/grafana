import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { contextSrv } from 'app/core/services/context_srv';
import { mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { Alerts } from './Alerts';

jest.mock('app/features/alerting/unified/api/alertmanager');
jest.mock('app/core/services/context_srv');

const mocks = {
  api: {
    // @PERCONA_TODO fix mocks
    fetchSilences: jest.mocked(() => {}),
    fetchAlerts: jest.mocked(() => {}),
    createOrUpdateSilence: jest.mocked(() => {}),
  },
  contextSrv: jest.mocked(contextSrv),
};

xdescribe('AlertsTable', () => {
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

  it('should render the table correctly', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<Alerts />)}
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
    expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
  });
});
