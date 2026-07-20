import { renderHook, waitFor } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole, mockDataSource } from '../../mocks';
import { setupAdminConfigGet } from '../../mocks/server/configure/admin_config';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

import { useShowImportToGMARulesBanner } from './useShowImportToGMARulesBanner';

const server = setupMswServer();

function renderUseShowImportToGMARulesBanner() {
  const wrapper = getWrapper({ renderWithRouter: false });
  return renderHook(() => useShowImportToGMARulesBanner(), { wrapper });
}

function setupExternalRulesSource() {
  const ds = mockDataSource({
    name: 'prometheus',
    uid: 'prometheus-uid',
    type: DataSourceType.Prometheus,
    jsonData: { manageAlerts: true },
  });
  setupDataSources(ds);
  return ds;
}

describe('useShowImportToGMARulesBanner', () => {
  beforeEach(() => {
    grantUserRole(OrgRole.Admin);
    grantUserPermissions([
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingProvisioningSetStatus,
      AccessControlAction.AlertingRuleExternalRead,
    ]);
    setupExternalRulesSource();
  });

  describe('with alertingMigrationWizardUI enabled', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationWizardUI'] });

    it('shows the banner when the user can import rules and a rule source exists', () => {
      const { result } = renderUseShowImportToGMARulesBanner();
      expect(result.current).toBe(true);
    });

    it('does not show the banner when there are no rule sources', () => {
      setupDataSources(); // replaces the datasource list with an empty one
      const { result } = renderUseShowImportToGMARulesBanner();
      expect(result.current).toBe(false);
    });
  });

  describe('with alertingMigrationWizardUI and alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationWizardUI', 'alerting.syncExternalAlertmanager'] });

    it('hides the banner while Mimir Alertmanager auto-sync is active', async () => {
      setupAdminConfigGet(server, {
        alertmanagersChoice: AlertmanagerChoice.Internal,
        external_alertmanager_uid: 'mimir-uid',
      });

      const { result } = renderUseShowImportToGMARulesBanner();

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('does not flash the banner before the auto-sync state has loaded', async () => {
      // Auto-sync is NOT active, but while the admin_config query is in flight we do not yet
      // know that, so the banner stays hidden and only appears once the response arrives.
      setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });

      const { result } = renderUseShowImportToGMARulesBanner();

      expect(result.current).toBe(false);
      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });
  });
});
