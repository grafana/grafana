import { render, screen } from 'test/test-utils';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../mockApi';
import { grantUserPermissions, mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';

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

    it('should hide AlertManagerPicker when external data sources have manageAlerts=false', () => {
      const dataSourceWithoutManageAlerts = mockDataSource<AlertManagerDataSourceJsonData>({
        name: 'prometheus-no-manage',
        uid: 'prometheus-no-manage-uid',
        type: 'prometheus',
        jsonData: {
          manageAlerts: false,
        },
      });
      setupDataSources(dataSourceWithoutManageAlerts);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.queryByTestId('alertmanager-picker')).not.toBeInTheDocument();
    });

    it('should show AlertManagerPicker when external data sources have manageAlerts=true', () => {
      const dataSourceWithManageAlerts = mockDataSource({
        name: 'prometheus-managed',
        uid: 'prometheus-managed-uid',
        type: 'prometheus',
        jsonData: {
          manageAlerts: true,
        },
      });
      setupDataSources(dataSourceWithManageAlerts);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.getByTestId('alertmanager-picker')).toBeInTheDocument();
    });

    it('should show AlertManagerPicker when external data sources have manageAlerts=undefined and config default is true', () => {
      config.defaultDatasourceManageAlertsUiToggle = true;

      const dataSourceDefaultManageAlerts = mockDataSource({
        name: 'prometheus-default',
        uid: 'prometheus-default-uid',
        type: 'prometheus',
        jsonData: {}, // manageAlerts uses config.defaultDatasourceManageAlertsUiToggle when undefined
      });
      setupDataSources(dataSourceDefaultManageAlerts);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.getByTestId('alertmanager-picker')).toBeInTheDocument();
    });

    it('should hide AlertManagerPicker when external data sources have manageAlerts=undefined and config default is false', () => {
      config.defaultDatasourceManageAlertsUiToggle = false;

      const dataSourceDefaultManageAlerts = mockDataSource({
        name: 'prometheus-default',
        uid: 'prometheus-default-uid',
        type: 'prometheus',
        jsonData: {}, // manageAlerts uses config.defaultDatasourceManageAlertsUiToggle when undefined
      });
      setupDataSources(dataSourceDefaultManageAlerts);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.queryByTestId('alertmanager-picker')).not.toBeInTheDocument();
    });

    it('should show AlertManagerPicker when multiple external data sources exist with at least one managing alerts', () => {
      const dsWithManageAlerts = mockDataSource({
        name: 'prometheus-1',
        uid: 'prometheus-1-uid',
        type: 'prometheus',
        jsonData: {
          manageAlerts: true,
        },
      });

      const dsWithoutManageAlerts = mockDataSource({
        name: 'prometheus-2',
        uid: 'prometheus-2-uid',
        type: 'prometheus',
        jsonData: {
          manageAlerts: false,
        },
      });

      setupDataSources(dsWithManageAlerts, dsWithoutManageAlerts);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.getByTestId('alertmanager-picker')).toBeInTheDocument();
    });

    it('should work correctly when only Grafana built-in alertmanager is available (no external datasources)', () => {
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

    it('should show AlertManagerPicker for supported external data source types (Loki)', () => {
      const lokiDataSource = mockDataSource({
        name: 'loki-managed',
        uid: 'loki-managed-uid',
        type: 'loki',
        jsonData: {
          manageAlerts: true,
        },
      });
      setupDataSources(lokiDataSource);

      grantUserPermissions([
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingRuleExternalRead,
      ]);

      renderTestComponent();

      expect(screen.getByTestId('alertmanager-picker')).toBeInTheDocument();
    });

    it('should hide AlertManagerPicker when user lacks permissions even if external data sources exist', () => {
      const dataSourceWithManageAlerts = mockDataSource({
        name: 'prometheus-managed',
        uid: 'prometheus-managed-uid',
        type: 'prometheus',
        jsonData: {
          manageAlerts: true,
        },
      });
      setupDataSources(dataSourceWithManageAlerts);

      grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);

      renderTestComponent();

      expect(screen.queryByTestId('alertmanager-picker')).not.toBeInTheDocument();
    });
  });
});
