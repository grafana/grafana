import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import 'whatwg-fetch';

import SettingsPage from './Settings';
import {
  DataSourcesResponse,
  setupGrafanaManagedServer,
  withExternalOnlySetting,
} from './components/settings/__mocks__/server';
import { setupMswServer } from './mockApi';
import { grantUserRole } from './mocks';

// @TODO maybe abstract this somehow?
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));

const server = setupMswServer();

describe('Alerting settings', () => {
  beforeEach(() => {
    grantUserRole('ServerAdmin');
    setupGrafanaManagedServer(server);
  });

  it('should render the page with the correct title', async () => {
    render(<SettingsPage />, { wrapper: TestProvider });

    await waitFor(() => {
      expect(screen.getByText('Built-in Alertmanager')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Grafana built-in' })).toBeInTheDocument();
      expect(screen.getByText('Receiving Grafana-managed alerts')).toBeInTheDocument();

      expect(screen.getByText('Other Alertmanagers')).toBeInTheDocument();

      DataSourcesResponse.forEach((ds) => {
        // expect link to data source, provisioned badge, type, and status
        // expect(screen.getByRole('link', { name: ds.name })).toBeInTheDocument();
        // expect action buttons
      });
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
