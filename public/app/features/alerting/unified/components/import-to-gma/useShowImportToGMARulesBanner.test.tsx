import { renderHook, waitFor } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { type AlertManagerDataSourceJsonData, AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
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

function setupExternalAlertmanager() {
  const am = mockDataSource<AlertManagerDataSourceJsonData>({
    name: 'external-alertmanager',
    uid: 'external-alertmanager-uid',
    type: DataSourceType.Alertmanager,
  });
  setupDataSources(am);
  return am;
}

describe('useShowImportToGMARulesBanner', () => {
  beforeEach(() => {
    grantUserRole(OrgRole.Admin);
    grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingProvisioningSetStatus]);
    setupExternalAlertmanager();
  });

  describe('with alertingMigrationWizardUI enabled', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationWizardUI'] });

    it('shows the banner when the user can import rules and an external Alertmanager exists', () => {
      const { result } = renderUseShowImportToGMARulesBanner();
      expect(result.current).toBe(true);
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
  });
});
