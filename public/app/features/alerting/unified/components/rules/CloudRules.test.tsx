import { Provider } from 'react-redux';
import { render, screen, testWithFeatureToggles, waitFor } from 'test/test-utils';
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

describe('CloudRules — Mimir AM auto-sync gate', () => {
  beforeEach(() => {
    grantUserRole(OrgRole.Admin);
    grantUserPermissions([
      // External read is required for getRulesDataSources() to include the Mimir DS.
      AccessControlAction.AlertingRuleExternalRead,
      // Both grafana-managed perms are required to enable canMigrateToGMA.
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingProvisioningSetStatus,
      // Required for useIsAutoSyncActive to read the Config resource.
      AccessControlAction.ActionAlertingNotificationsConfigRead,
    ]);
  });

  describe('with alertingMigrationUI and alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationUI', 'alerting.syncExternalAlertmanager'] });

    it('disables the data source import button with a tooltip when Mimir AM auto-sync is configured', async () => {
      setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

      const { user } = renderWithCloudResults();

      // Re-query each tick — the LinkButton re-mounts as `disabled` flips, so a single captured
      // reference can become stale.
      await waitFor(() => {
        expect(ui.migrateButton.get()).toHaveAttribute('aria-disabled', 'true');
      });

      // The disabled `<a>` has `pointer-events: none`; the tooltip handlers attach to the wrapping
      // span. Hover that ancestor so the floating-ui hover registers in jsdom.
      // eslint-disable-next-line testing-library/no-node-access
      const tooltipTarget = ui.migrateButton.get().parentElement!;
      await user.hover(tooltipTarget);
      expect(await screen.findByRole('tooltip', { name: /auto-sync/i })).toBeInTheDocument();
    });

    it('enables the data source import button when Mimir AM auto-sync is not configured', async () => {
      setupAutoSyncConfig(server, {});

      renderWithCloudResults();

      const btn = await ui.migrateButton.find();
      expect(btn).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('with alerting.syncExternalAlertmanager feature flag off', () => {
    testWithFeatureToggles({ enable: ['alertingMigrationUI'] });

    it('enables the data source import button regardless of Config state', async () => {
      // Flag off ⇒ useIsAutoSyncActive short-circuits via skipToken; the Config query must
      // never fire even when a sync is configured. Asserting the request never fired is what
      // makes this fail on a missing gate — the button starts enabled anyway.
      const { requestSpy } = setupAutoSyncConfig(server, { specUid: 'mimir-uid' });

      renderWithCloudResults();

      const btn = await ui.migrateButton.find();
      expect(btn).not.toHaveAttribute('aria-disabled', 'true');
      expect(requestSpy).not.toHaveBeenCalled();
    });
  });
});
