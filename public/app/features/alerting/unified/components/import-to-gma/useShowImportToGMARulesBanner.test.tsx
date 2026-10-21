import { act, renderHook, waitFor } from '@testing-library/react';
import { getWrapper, testWithFeatureToggles } from 'test/test-utils';

import { OrgRole } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole, mockDataSource } from '../../mocks';
import { setupAutoSyncConfig } from '../../mocks/server/handlers/k8s/config.k8s';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

import { useShowImportToGMARulesBanner } from './useShowImportToGMARulesBanner';

const server = setupMswServer();

const IMPORT_WIZARD_FLAGS = {
  [FlagKeys.AlertingMigrationWizardUI]: true,
  [FlagKeys.AlertingImportAlertmanagerAPI]: true,
};

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
      AccessControlAction.ActionAlertingNotificationsConfigRead,
    ]);
    setupExternalRulesSource();
  });

  describe('with alertingMigrationWizardUI enabled', () => {
    beforeEach(() => setTestFlags(IMPORT_WIZARD_FLAGS));
    // The reset fires OpenFeature events while components are still mounted, so it needs act.
    afterEach(async () => {
      await act(async () => {
        setTestFlags();
      });
    });

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

  describe('with alertingMigrationWizardUI enabled but the Alertmanager import API off', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.AlertingMigrationWizardUI]: true }));
    // The reset fires OpenFeature events while components are still mounted, so it needs act.
    afterEach(async () => {
      await act(async () => {
        setTestFlags();
      });
    });

    it('does not show the banner, since it promotes importing an Alertmanager', () => {
      const { result } = renderUseShowImportToGMARulesBanner();
      expect(result.current).toBe(false);
    });
  });

  describe('with alertingMigrationWizardUI and alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });
    beforeEach(() => setTestFlags(IMPORT_WIZARD_FLAGS));
    // The reset fires OpenFeature events while components are still mounted, so it needs act.
    afterEach(async () => {
      await act(async () => {
        setTestFlags();
      });
    });

    it('hides the banner while Mimir Alertmanager auto-sync is active', async () => {
      setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

      const { result } = renderUseShowImportToGMARulesBanner();

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it('does not flash the banner before the auto-sync state has loaded', async () => {
      // Auto-sync is NOT active, but while the Config query is in flight we do not yet
      // know that, so the banner stays hidden and only appears once the response arrives.
      setupAutoSyncConfig(server, {});

      const { result } = renderUseShowImportToGMARulesBanner();

      expect(result.current).toBe(false);
      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });
  });
});
