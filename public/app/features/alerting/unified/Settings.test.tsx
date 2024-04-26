import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { render } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import SettingsPage from './Settings';
import {
  DataSourcesResponse,
  setupGrafanaManagedServer,
  withExternalOnlySetting,
} from './components/settings/__mocks__/server';
import { setupMswServer } from './mockApi';
import { grantUserRole } from './mocks';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));

const server = setupMswServer();

const ui = {
  builtInAlertmanagerSection: byText('Built-in Alertmanager'),
  otherAlertmanagerSection: byText('Other Alertmanagers'),

  builtInAlertmanagerCard: byTestId('alertmanager-card-Grafana built-in'),
  otherAlertmanagerCard: (name: string) => byTestId(`alertmanager-card-${name}`),

  statusReceiving: byText(/receiving grafana-managed alerts/i),
  statusNotReceiving: byText(/not receiving/i),

  configurationDrawer: byRole('dialog', { name: 'Drawer title Internal Grafana Alertmanager' }),
  editConfigurationButton: byRole('button', { name: /edit configuration/i }),
  saveConfigurationButton: byRole('button', { name: /save/i }),

  versionsTab: byRole('tab', { name: /versions/i }),
};

describe('Alerting settings', () => {
  beforeEach(() => {
    grantUserRole('ServerAdmin');
    setupGrafanaManagedServer(server);
  });

  it('should render the page with Built-in only enabled, others disabled', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument();
      expect(ui.otherAlertmanagerSection.get()).toBeInTheDocument();
    });

    // check internal alertmanager configuration
    expect(ui.builtInAlertmanagerCard.get()).toBeInTheDocument();

    expect(ui.statusReceiving.get(ui.builtInAlertmanagerCard.get())).toBeInTheDocument();

    // check external altermanagers
    DataSourcesResponse.forEach((ds) => {
      // get the card for datasource
      const card = ui.otherAlertmanagerCard(ds.name).get();

      // expect link to data source, provisioned badge, type, and status
      expect(within(card).getByRole('link', { name: ds.name })).toBeInTheDocument();
    });
  });

  it('should render the page with external only', async () => {
    render(<SettingsPage />);
    withExternalOnlySetting(server);

    await waitFor(() => {
      expect(ui.statusReceiving.query()).not.toBeInTheDocument();
    });
  });

  it('should be able to view configuration', async () => {
    render(<SettingsPage />);

    // wait for loading to be done
    await waitFor(() => expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument());

    // open configuration drawer
    const internalAMCard = ui.builtInAlertmanagerCard.get();
    const editInternal = ui.editConfigurationButton.get(internalAMCard);
    await userEvent.click(editInternal);

    await waitFor(() => {
      expect(ui.configurationDrawer.get()).toBeInTheDocument();
    });

    await userEvent.click(ui.saveConfigurationButton.get());
    expect(ui.saveConfigurationButton.get()).toBeDisabled();

    await waitFor(() => {
      expect(ui.saveConfigurationButton.get()).not.toBeDisabled();
    });
  });

  it('should be able to view versions', async () => {
    render(<SettingsPage />);

    // wait for loading to be done
    await waitFor(() => expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument());

    // open configuration drawer
    const internalAMCard = ui.builtInAlertmanagerCard.get();
    const editInternal = ui.editConfigurationButton.get(internalAMCard);
    await userEvent.click(editInternal);

    await waitFor(() => {
      expect(ui.configurationDrawer.get()).toBeInTheDocument();
    });

    // click versions tab
    await userEvent.click(ui.versionsTab.get());

    await waitFor(() => {
      expect(screen.getByText(/last applied/i)).toBeInTheDocument();
    });
  });
});
