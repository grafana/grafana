import { screen, waitFor, within } from '@testing-library/react';
import { render } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import SettingsPage from './Settings';
import DataSourcesResponse from './components/settings/mocks/api/datasources.json';
import { setupGrafanaManagedServer, withExternalOnlySetting } from './components/settings/mocks/server';
import { setupMswServer } from './mockApi';
import { grantUserRole } from './mocks';
import { addSettingsSection, clearSettingsExtensions } from './settings/extensions';

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

  configurationDrawer: byRole('dialog', { name: 'Drawer title Grafana built-in Alertmanager' }),
  editConfigurationButton: byRole('button', { name: /edit configuration/i }),
  viewConfigurationButton: byRole('button', { name: /view configuration/i }),
  saveConfigurationButton: byRole('button', { name: /save/i }),

  enableButton: byRole('button', { name: 'Enable' }),
  disableButton: byRole('button', { name: 'Disable' }),

  versionsTab: byRole('tab', { name: /versions/i }),
  provisionedBadge: byText(/^Provisioned$/),

  // New selectors for extension tabs
  alertmanagerTab: byRole('tab', { name: 'Alert managers' }),
  enrichmentTab: byRole('tab', { name: 'Enrichment' }),
  notificationsTab: byRole('tab', { name: 'Notifications' }),
  customTab: (name: string) => byRole('tab', { name }),
};

describe('Alerting settings', () => {
  beforeEach(() => {
    grantUserRole('ServerAdmin');
    setupGrafanaManagedServer(server);
    clearSettingsExtensions();
  });

  afterEach(() => {
    clearSettingsExtensions();
  });

  it('should render the page with Built-in only enabled, others disabled', async () => {
    render(<SettingsPage />);

    expect(await ui.builtInAlertmanagerSection.find()).toBeInTheDocument();
    expect(ui.otherAlertmanagerSection.get()).toBeInTheDocument();

    // check internal alertmanager configuration
    expect(ui.builtInAlertmanagerCard.get()).toBeInTheDocument();

    expect(ui.statusReceiving.get(ui.builtInAlertmanagerCard.get())).toBeInTheDocument();

    // check external alertmanagers
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
    const { user } = render(<SettingsPage />);

    // wait for loading to be done
    await waitFor(() => expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument());

    // open configuration drawer
    const internalAMCard = ui.builtInAlertmanagerCard.get();
    await user.click(ui.viewConfigurationButton.get(internalAMCard));
    expect(await ui.configurationDrawer.find()).toBeInTheDocument();

    expect(ui.saveConfigurationButton.query()).not.toBeInTheDocument();
  });

  it('should be able to view versions', async () => {
    const { user } = render(<SettingsPage />);

    // wait for loading to be done
    expect(await ui.builtInAlertmanagerSection.find()).toBeInTheDocument();

    // open configuration drawer
    const internalAMCard = ui.builtInAlertmanagerCard.get();
    await user.click(ui.viewConfigurationButton.get(internalAMCard));
    expect(await ui.configurationDrawer.find()).toBeInTheDocument();

    await waitFor(() => {
      expect(ui.configurationDrawer.get()).toBeInTheDocument();
    });

    // click versions tab
    await user.click(ui.versionsTab.get());

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

  it('should display additional tabs when settings extensions are registered', async () => {
    // Register extensions before rendering
    addSettingsSection({
      id: 'enrichment',
      text: 'Enrichment',
      url: '/alerting/admin/enrichment',
      icon: 'star',
    });

    addSettingsSection({
      id: 'notifications',
      text: 'Notifications',
      url: '/alerting/admin/notifications',
      icon: 'bell',
    });

    render(<SettingsPage />, {
      historyOptions: {
        initialEntries: ['/alerting/admin/alertmanager'],
      },
    });

    // Wait for the page to load
    await waitFor(() => expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument());

    // Check that the extension tabs are visible
    expect(ui.enrichmentTab.get()).toBeInTheDocument();
    expect(ui.notificationsTab.get()).toBeInTheDocument();
  });

  it('should correctly show active state for extension tabs based on route', async () => {
    // Register an extension
    addSettingsSection({
      id: 'enrichment',
      text: 'Enrichment',
      url: '/alerting/admin/enrichment',
      icon: 'star',
    });

    // Render with the extension route as active
    render(<SettingsPage />, {
      historyOptions: {
        initialEntries: ['/alerting/admin/enrichment'],
      },
    });

    // Wait for the page to load
    await waitFor(() => expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument());

    // Check that the extension tab is visible and active
    const enrichmentTab = ui.enrichmentTab.get();
    expect(enrichmentTab).toBeInTheDocument();
    expect(enrichmentTab).toHaveAttribute('aria-selected', 'true');

    // Check that the default alertmanager tab is not active
    const alertmanagerTab = ui.alertmanagerTab.get();
    expect(alertmanagerTab).toHaveAttribute('aria-selected', 'false');
  });

  it('should handle multiple extensions correctly', async () => {
    // Register multiple extensions
    addSettingsSection({
      id: 'enrichment',
      text: 'Enrichment',
      url: '/alerting/admin/enrichment',
      icon: 'star',
    });

    addSettingsSection({
      id: 'notifications',
      text: 'Notifications',
      url: '/alerting/admin/notifications',
      icon: 'bell',
    });

    addSettingsSection({
      id: 'custom-settings',
      text: 'Custom Settings',
      url: '/alerting/admin/custom',
      icon: 'cog',
    });

    render(<SettingsPage />, {
      historyOptions: {
        initialEntries: ['/alerting/admin/alertmanager'],
      },
    });

    // Wait for the page to load
    await waitFor(() => expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument());

    // Check that all tabs are visible
    expect(ui.alertmanagerTab.get()).toBeInTheDocument();
    expect(ui.enrichmentTab.get()).toBeInTheDocument();
    expect(ui.notificationsTab.get()).toBeInTheDocument();
    expect(ui.customTab('Custom Settings').get()).toBeInTheDocument();
  });

  it('should not show extension tabs when no extensions are registered', async () => {
    render(<SettingsPage />, {
      historyOptions: {
        initialEntries: ['/alerting/admin/alertmanager'],
      },
    });

    // Wait for the page to load
    await waitFor(() => expect(ui.builtInAlertmanagerSection.get()).toBeInTheDocument());

    // Check that only the default alertmanager tab is visible
    expect(ui.alertmanagerTab.get()).toBeInTheDocument();
    expect(ui.enrichmentTab.query()).not.toBeInTheDocument();
    expect(ui.notificationsTab.query()).not.toBeInTheDocument();
  });
});
