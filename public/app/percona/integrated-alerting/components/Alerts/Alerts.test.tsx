import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { OrgRole } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { mockAlertmanagerAlert } from 'app/features/alerting/unified/mocks';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { Alerts } from './Alerts';

const mockAlerts = (isLoading = false) =>
  jest.spyOn(alertmanagerApi.endpoints.getAlertmanagerAlerts, 'useQuery').mockReturnValue({
    data: [
      mockAlertmanagerAlert({
        labels: { foo: 'bar' },
        status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
      }),
      mockAlertmanagerAlert({
        labels: { foo: 'buzz' },
        status: { state: AlertState.Active, silencedBy: ['67890'], inhibitedBy: [] },
      }),
    ],
    isLoading,
    error: {},
  } as unknown as ReturnType<typeof alertmanagerApi.endpoints.getAlertmanagerAlerts.useQuery>);

describe('AlertsTable', () => {
  beforeEach(() => {
    config.bootData.user.orgRole = OrgRole.Admin;
  });

  it('shows loading when fetching alerts', async () => {
    mockAlerts(true);

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

    expect(screen.getByTestId('table-loading')).toBeDefined();
  });

  it('should render the table correctly', async () => {
    mockAlerts();
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

    expect(screen.getAllByRole('row')).toHaveLength(1 + 2);
    expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
  });

  it('should be accessible to editor', () => {
    config.bootData.user.orgRole = OrgRole.Editor;

    mockAlerts();
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

    expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
  });

  it('editors should be able to silence alerts', () => {
    config.bootData.user.orgRole = OrgRole.Editor;

    mockAlerts();
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

    expect(screen.queryByTestId('silence-alert-row-1')).toHaveAttribute('aria-disabled', 'false');
  });

  it('should be accessible to viewer', () => {
    config.bootData.user.orgRole = OrgRole.Viewer;

    mockAlerts();
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

    expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument();
  });

  it("viewers shouldn't be able to silence alerts", () => {
    config.bootData.user.orgRole = OrgRole.Viewer;

    mockAlerts();
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

    expect(screen.queryByTestId('silence-alert-row-1')).toHaveAttribute('aria-disabled', 'true');
  });
});
