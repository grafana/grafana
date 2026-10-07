import { Provider } from 'react-redux';
import { render, testWithFeatureToggles } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { OrgRole } from '@grafana/data';
import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole, mockUnifiedAlertingStore } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';
import { setupAutoSyncConfig } from '../../mocks/server/handlers/k8s/config.k8s';

import { CloudRules } from './CloudRules';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

const server = setupMswServer();

const ui = {
  // Substring regex — the link's accessible name also includes the "New!" badge text.
  migrateButton: byRole('link', { name: /import to grafana-managed rules/i }),
};

function renderWithCloudResults() {
  const { dataSource } = mimirDataSource();
  const store = mockUnifiedAlertingStore({
    promRules: {
      [dataSource.name]: { loading: false, dispatched: true, result: [{}] as never },
    },
  });
  return render(
    <Provider store={store}>
      <CloudRules namespaces={[]} expandAll={false} />
    </Provider>
  );
}

describe('CloudRules — Mimir AM auto-sync', () => {
  beforeEach(() => {
    grantUserRole(OrgRole.Admin);
    grantUserPermissions([
      // External read is required for getRulesDataSources() to include the Mimir DS.
      AccessControlAction.AlertingRuleExternalRead,
      // Both grafana-managed perms are required to enable canMigrateToGMA.
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingProvisioningSetStatus,
      // Read access to the sync Config, so a reinstated gate would resolve rather than fail open.
      AccessControlAction.ActionAlertingNotificationsConfigRead,
    ]);
  });

  describe('with alertingMigrationUI and alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationUI', 'alerting.syncExternalAlertmanager'] });

    // Auto-sync mirrors only the Alertmanager configuration, and the rule convert endpoints have no
    // sync check, so this rules-only button must not consult the sync state at all. Asserting the
    // Config query never fires is what makes this fail if the gate is reinstated — the button starts
    // enabled either way.
    it('keeps the data source import button enabled while Mimir AM auto-sync is configured', async () => {
      const { requestSpy } = setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

      renderWithCloudResults();

      const btn = await ui.migrateButton.find();
      expect(btn).not.toHaveAttribute('aria-disabled', 'true');
      expect(requestSpy).not.toHaveBeenCalled();
    });
  });
});
