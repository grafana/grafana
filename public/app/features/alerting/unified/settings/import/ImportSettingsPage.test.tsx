import { render, testWithFeatureToggles } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AccessControlAction } from 'app/types/accessControl';

import { setupGrafanaManagedServer } from '../../components/settings/mocks/server';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import ImportSettingsPage from './ImportSettingsPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));

const server = setupMswServer();

const ui = {
  autoSyncCard: byRole('region', { name: /auto-sync configuration/i }),
  emptyState: byText(/no configuration imported yet/i),
  importCta: byRole('link', { name: /import alertmanager configuration/i }),
  learnMoreLink: byRole('link', { name: /learn more about importing configurations/i }),
  noPermission: byText(/don't have permission to view imported configurations/i),
};

describe('Import settings tab', () => {
  beforeEach(() => {
    grantUserRole('ServerAdmin');
    grantUserPermissions([AccessControlAction.AlertingNotificationsExternalRead]);
    setupGrafanaManagedServer(server);
    // DataSourcePicker (auto-sync) reads from getDataSourceSrv(); initialise it.
    setupDataSources();
  });

  it('shows the empty state with an import CTA and learn-more link when no configuration is staged', async () => {
    render(<ImportSettingsPage />);

    expect(await ui.emptyState.find()).toBeInTheDocument();
    expect(ui.importCta.get()).toBeInTheDocument();
    expect(ui.learnMoreLink.get()).toBeInTheDocument();
  });

  it('shows a permission notice instead of the empty state when the user cannot view configurations', async () => {
    grantUserPermissions([]);
    render(<ImportSettingsPage />);

    expect(await ui.noPermission.find()).toBeInTheDocument();
    expect(ui.emptyState.query()).not.toBeInTheDocument();
  });

  it('does not render the relocated auto-sync card when the sync flag is off', async () => {
    render(<ImportSettingsPage />);

    await ui.emptyState.find();
    expect(ui.autoSyncCard.query()).not.toBeInTheDocument();
  });

  describe('with alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    it('renders the relocated auto-sync card', async () => {
      render(<ImportSettingsPage />);

      expect(await ui.autoSyncCard.find()).toBeInTheDocument();
    });
  });
});
