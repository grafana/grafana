import { Provider } from 'react-redux';
import { render, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { OrgRole } from '@grafana/data';
import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole, mockUnifiedAlertingStore } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';
import { setupAdminConfigGet } from '../../mocks/server/configure/admin_config';

import { CloudRules } from './CloudRules';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

const server = setupMswServer();

const ui = {
  sectionHeading: byRole('heading', { name: /data source-managed/i }),
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

describe('CloudRules — Mimir AM auto-sync gate', () => {
  beforeEach(() => {
    grantUserRole(OrgRole.Admin);
    grantUserPermissions([
      // External read is required for getRulesDataSources() to include the Mimir DS.
      AccessControlAction.AlertingRuleExternalRead,
      // Both grafana-managed perms are required to enable canMigrateToGMA.
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingProvisioningSetStatus,
    ]);
  });

  describe('with alertingMigrationUI and alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationUI', 'alerting.syncExternalAlertmanager'] });

    it('hides the data source import button when Mimir AM auto-sync is configured for the org', async () => {
      setupAdminConfigGet(server, {
        alertmanagersChoice: AlertmanagerChoice.Internal,
        external_alertmanager_uid: 'mimir-uid',
      });

      renderWithCloudResults();

      // Wait for the section to render so we know the component mounted, then retry the
      // assertion until the admin_config query has resolved and the button is hidden.
      expect(await ui.sectionHeading.find()).toBeInTheDocument();
      await waitFor(() => {
        expect(ui.migrateButton.query()).not.toBeInTheDocument();
      });
    });

    it('shows the data source import button when Mimir AM auto-sync is not configured', async () => {
      setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });

      renderWithCloudResults();

      expect(await ui.migrateButton.find()).toBeInTheDocument();
    });
  });

  describe('with alerting.syncExternalAlertmanager feature flag off', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationUI'] });

    it('shows the data source import button regardless of admin_config state', async () => {
      renderWithCloudResults();

      expect(await ui.migrateButton.find()).toBeInTheDocument();
    });
  });
});
