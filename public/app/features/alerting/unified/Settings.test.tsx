import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import SettingsPage from './Settings';
import DataSourcesResponse from './components/settings/__mocks__/api/datasources.json';
import { setupGrafanaManagedServer, withExternalOnlySetting } from './components/settings/__mocks__/server';
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

  alertmanagerCard: (name: string) => byTestId(`alertmanager-card-${name}`),
  builtInAlertmanagerCard: byTestId('alertmanager-card-Grafana built-in'),

  statusReceiving: byText(/receiving grafana-managed alerts/i),
  statusNotReceiving: byText(/not receiving/i),

  configurationDrawer: byRole('dialog', { name: 'Drawer title Internal Grafana Alertmanager' }),
  editConfigurationButton: byRole('button', { name: /edit configuration/i }),
  saveConfigurationButton: byRole('button', { name: /save/i }),

  enableButton: byRole('button', { name: 'Enable' }),
  disableButton: byRole('button', { name: 'Disable' }),

  versionsTab: byRole('tab', { name: /versions/i }),
  provisionedBadge: byText(/^Provisioned$/),
};

describe('Alerting settings', () => {
  beforeEach(() => {
    grantUserRole('ServerAdmin');
    setupGrafanaManagedServer(server);
  });

  it('should render the page with Built-in only enabled, others disabled', async () => {
    render(<SettingsPage />);

    expect(await ui.builtInAlertmanagerSection.find()).toBeInTheDocument();
    expect(ui.otherAlertmanagerSection.get()).toBeInTheDocument();

    // check internal alertmanager configuration
    expect(ui.builtInAlertmanagerCard.get()).toBeInTheDocument();

    expect(ui.statusReceiving.get(ui.builtInAlertmanagerCard.get())).toBeInTheDocument();

    // check external altermanagers
    DataSourcesResponse.forEach((ds) => {
      // get the card for datasource
      const card = ui.alertmanagerCard(ds.name).get();

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
      expect(ui.saveConfigurationButton.get()).toBeEnabled();
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

  it('should correctly render provisioned data sources', async () => {
    render(<SettingsPage />);

    // wait for loading to be done
    await waitFor(() => expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument());

    // provisioned alertmanager card
    const provisionedCard = ui.alertmanagerCard('Provisioned Mimir-based Alertmanager').get();
    expect(ui.provisionedBadge.get(provisionedCard)).toBeInTheDocument();

    // should still be editable
    const editConfigButton = ui.editConfigurationButton.get(provisionedCard);
    expect(editConfigButton).toBeInTheDocument();

    // enable / disable should not be avaiable when provisioned
    const enableButton = ui.enableButton.query(provisionedCard);
    const disableButton = ui.disableButton.query(provisionedCard);

    expect(enableButton).not.toBeInTheDocument();
    expect(disableButton).not.toBeInTheDocument();
  });
});
