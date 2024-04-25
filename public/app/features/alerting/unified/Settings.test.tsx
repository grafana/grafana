import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import SettingsPage from './Settings';
import {
  DataSourcesResponse,
  setupGrafanaManagedServer,
  withExternalOnlySetting,
} from './components/settings/__mocks__/server';
import { setupMswServer } from './mockApi';
import { grantUserRole } from './mocks';

const server = setupMswServer();

describe('Alerting settings', () => {
  beforeEach(() => {
    grantUserRole('ServerAdmin');
    setupGrafanaManagedServer(server);
  });

  it('should render the page with Built-in only enabled, others disabled', async () => {
    render(<SettingsPage />, { wrapper: TestProvider });

    await waitFor(() => {
      expect(screen.getByText('Built-in Alertmanager')).toBeInTheDocument();
      expect(screen.getByText('Other Alertmanagers')).toBeInTheDocument();
    });

    // check internal alertmanager configuration
    expect(screen.getByText('Receiving Grafana-managed alerts')).toBeInTheDocument();
    const builtInAlertmanagerCard = screen.getByTestId('alertmanager-card-Grafana built-in');
    expect(within(builtInAlertmanagerCard).getByText(/Receiving Grafana-managed/i)).toBeInTheDocument();

    // check external altermanagers
    DataSourcesResponse.forEach((ds) => {
      // get the card for datasource
      const card = screen.getByTestId(`alertmanager-card-${ds.name}`);

      // expect link to data source, provisioned badge, type, and status
      expect(within(card).getByRole('link', { name: ds.name })).toBeInTheDocument();
    });
  });

  it('should render the page with external only', async () => {
    render(<SettingsPage />, { wrapper: TestProvider });
    withExternalOnlySetting(server);

    await waitFor(() => {
      expect(screen.queryByText('Receiving Grafana-managed alerts')).not.toBeInTheDocument();
    });
  });
});
