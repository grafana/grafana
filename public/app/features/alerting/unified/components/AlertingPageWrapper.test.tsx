import { render, screen } from 'test/test-utils';

import { NavModelItem } from '@grafana/data';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { DataSourceType } from '../utils/datasource';

import { AlertmanagerPageWrapper } from './AlertingPageWrapper';

// Minimal pageNav required for PageHeader to render (which renders the actions prop including AlertManagerPicker)
const testPageNav: NavModelItem = {
  text: 'Alerting',
  url: '/alerting',
};

setupMswServer();

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
});
