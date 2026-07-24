import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { type NavModelItem, OrgRole } from '@grafana/data';
import { type AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, grantUserRole, mockDataSource } from '../mocks';
import { setupAutoSyncConfig } from '../mocks/server/handlers/k8s/config.k8s';
import { setupDataSources } from '../testSetup/datasources';
import { ALERTMANAGER_NAME_QUERY_KEY } from '../utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { AlertmanagerPageWrapper } from './AlertingPageWrapper';

// Minimal pageNav required for PageHeader to render (which renders the actions prop including AlertManagerPicker)
const testPageNav: NavModelItem = {
  text: 'Alerting',
  url: '/alerting',
};

const server = setupMswServer();

describe('AlertmanagerPageWrapper', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderTestComponent = () => {
    return render(
      <AlertmanagerPageWrapper accessType="notification" pageNav={testPageNav}>
        <div>Test content</div>
      </AlertmanagerPageWrapper>
    );
  };

  describe('AlertManagerPicker visibility', () => {
    it('should hide AlertManagerPicker when no external data sources are configured', () => {
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.queryByTestId('alertmanager-picker')).not.toBeInTheDocument();
    });

    it('should hide AlertManagerPicker when only Prometheus-compatible datasources exist (even with manageAlerts=true)', () => {
      const prometheusWithManageAlerts = mockDataSource({
        name: 'prometheus-managed',
        uid: 'prometheus-managed-uid',
        type: 'prometheus',
        jsonData: {
          manageAlerts: true,
        },
      });
      setupDataSources(prometheusWithManageAlerts);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.queryByTestId('alertmanager-picker')).not.toBeInTheDocument();
    });

    it('should hide AlertManagerPicker when only Loki datasources exist (even with manageAlerts=true)', () => {
      const lokiWithManageAlerts = mockDataSource({
        name: 'loki-managed',
        uid: 'loki-managed-uid',
        type: 'loki',
        jsonData: {
          manageAlerts: true,
        },
      });
      setupDataSources(lokiWithManageAlerts);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.queryByTestId('alertmanager-picker')).not.toBeInTheDocument();
    });

    it('should show AlertManagerPicker when an Alertmanager-type datasource exists', () => {
      const alertmanagerDataSource = mockDataSource<AlertManagerDataSourceJsonData>({
        name: 'external-alertmanager',
        uid: 'external-alertmanager-uid',
        type: DataSourceType.Alertmanager,
      });
      setupDataSources(alertmanagerDataSource);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
      ]);

      renderTestComponent();

      expect(screen.getByTestId('alertmanager-picker')).toBeInTheDocument();
    });

    it('should show AlertManagerPicker when both Prometheus and Alertmanager datasources exist', () => {
      const prometheusDs = mockDataSource({
        name: 'prometheus-1',
        uid: 'prometheus-1-uid',
        type: 'prometheus',
        jsonData: {
          manageAlerts: true,
        },
      });
      const alertmanagerDs = mockDataSource<AlertManagerDataSourceJsonData>({
        name: 'external-alertmanager',
        uid: 'external-alertmanager-uid',
        type: DataSourceType.Alertmanager,
      });
      setupDataSources(prometheusDs, alertmanagerDs);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.getByTestId('alertmanager-picker')).toBeInTheDocument();
    });

    it('should hide AlertManagerPicker when user lacks external notifications permission even if Alertmanager datasources exist', () => {
      const alertmanagerDataSource = mockDataSource<AlertManagerDataSourceJsonData>({
        name: 'external-alertmanager',
        uid: 'external-alertmanager-uid',
        type: DataSourceType.Alertmanager,
      });
      setupDataSources(alertmanagerDataSource);

      // AlertingNotificationsRead grants access to the built-in Grafana AM only;
      // AlertingNotificationsExternalRead is required to see external AM datasources.
      grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);

      renderTestComponent();

      expect(screen.queryByTestId('alertmanager-picker')).not.toBeInTheDocument();
    });

    it('should hide AlertManagerPicker when only Grafana built-in alertmanager is available (no external datasources)', () => {
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);

      render(
        <AlertmanagerPageWrapper accessType="notification" pageNav={testPageNav}>
          <div>Built-in alertmanager content</div>
        </AlertmanagerPageWrapper>
      );

      expect(screen.queryByTestId('alertmanager-picker')).not.toBeInTheDocument();
    });
  });

  describe('ImportToGMA banner', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationWizardUI'] });

    const importBanner = byRole('link', { name: /import to grafana alerting/i });

    const setupExternalAlertmanager = () => {
      const alertmanagerDataSource = mockDataSource<AlertManagerDataSourceJsonData>({
        name: 'external-alertmanager',
        uid: 'external-alertmanager-uid',
        type: DataSourceType.Alertmanager,
      });
      setupDataSources(alertmanagerDataSource);
      return alertmanagerDataSource;
    };

    const renderWithSelectedAlertmanager = (alertmanagerName: string) =>
      render(
        <AlertmanagerPageWrapper accessType="notification" pageNav={testPageNav}>
          <div>Test content</div>
        </AlertmanagerPageWrapper>,
        {
          historyOptions: {
            initialEntries: [`/alerting/notifications?${ALERTMANAGER_NAME_QUERY_KEY}=${alertmanagerName}`],
          },
        }
      );

    it('shows the import banner when an external Alertmanager is selected and the user can import notifications', async () => {
      const externalAm = setupExternalAlertmanager();
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);

      renderWithSelectedAlertmanager(externalAm.name);

      expect(await importBanner.find()).toBeInTheDocument();
    });

    it('does not show the import banner when the Grafana Alertmanager is selected', async () => {
      setupExternalAlertmanager();
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);

      renderWithSelectedAlertmanager(GRAFANA_RULES_SOURCE_NAME);

      expect(await screen.findByText('Test content')).toBeInTheDocument();
      expect(importBanner.query()).not.toBeInTheDocument();
    });

    it('does not show the import banner when the user cannot import notifications', async () => {
      const externalAm = setupExternalAlertmanager();
      // Read-only external access, no notifications write permission.
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
      ]);

      renderWithSelectedAlertmanager(externalAm.name);

      expect(await screen.findByText('Test content')).toBeInTheDocument();
      expect(importBanner.query()).not.toBeInTheDocument();
    });

    describe('while Mimir Alertmanager auto-sync is active', () => {
      testWithFeatureToggles({ enable: ['alertingMigrationWizardUI', 'alerting.syncExternalAlertmanager'] });

      it('does not show the import banner', async () => {
        const externalAm = setupExternalAlertmanager();
        grantUserRole(OrgRole.Admin);
        grantUserPermissions([
          AccessControlAction.AlertingNotificationsRead,
          AccessControlAction.AlertingNotificationsExternalRead,
          AccessControlAction.AlertingNotificationsWrite,
          AccessControlAction.ActionAlertingNotificationsConfigRead,
        ]);
        setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

        renderWithSelectedAlertmanager(externalAm.name);

        expect(await screen.findByText('Test content')).toBeInTheDocument();
        // The banner renders before the Config query resolves, then hides once auto-sync
        // is known to be active, so wait for it to be removed.
        await waitFor(() => {
          expect(importBanner.query()).not.toBeInTheDocument();
        });
      });
    });
  });

  describe('ImportToGMA banner with feature toggle disabled', () => {
    testWithFeatureToggles({ enable: [] });

    it('does not show the import banner when the feature toggle is off', async () => {
      const alertmanagerDataSource = mockDataSource<AlertManagerDataSourceJsonData>({
        name: 'external-alertmanager',
        uid: 'external-alertmanager-uid',
        type: DataSourceType.Alertmanager,
      });
      setupDataSources(alertmanagerDataSource);
      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsWrite,
      ]);

      render(
        <AlertmanagerPageWrapper accessType="notification" pageNav={testPageNav}>
          <div>Test content</div>
        </AlertmanagerPageWrapper>,
        {
          historyOptions: {
            initialEntries: [`/alerting/notifications?${ALERTMANAGER_NAME_QUERY_KEY}=${alertmanagerDataSource.name}`],
          },
        }
      );

      expect(await screen.findByText('Test content')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /import to grafana alerting/i })).not.toBeInTheDocument();
    });
  });
});
