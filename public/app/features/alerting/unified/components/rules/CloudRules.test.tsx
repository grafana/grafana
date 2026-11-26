import { Provider } from 'react-redux';
import { render, screen, testWithFeatureToggles } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { type RulesSourceDataSource } from '@grafana/alerting/internal';
import { type DataSourceInstanceSettings, OrgRole } from '@grafana/data';
import { setPluginComponentsHook, setPluginLinksHook } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { type DataSourcesForRulesResult } from '../../hooks/useDataSourcesForRules';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole } from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';
import { setupAutoSyncConfig } from '../../mocks/server/handlers/k8s/config.k8s';
import { mockUnifiedAlertingStore } from '../../testSetup/mockUnifiedAlertingStore';

import { CloudRules } from './CloudRules';

setPluginLinksHook(() => ({ links: [], isLoading: false }));
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

const server = setupMswServer();

const ui = {
  // Substring regex — the link's accessible name also includes the "New!" badge text.
  migrateButton: byRole('link', { name: /import to grafana-managed rules/i }),
};

function toRulesSourceDataSource({ uid, name, meta }: DataSourceInstanceSettings): RulesSourceDataSource {
  return { uid, type: 'prometheus', name, meta, managesAlerts: true, allowedAsRecordingRuleTarget: true };
}

function renderWithCloudResults(rulesSources?: Partial<DataSourcesForRulesResult>) {
  const { dataSource } = mimirDataSource();
  const store = mockUnifiedAlertingStore({
    promRules: {
      [dataSource.name]: { loading: false, dispatched: true, result: [{}] as never },
    },
  });
  return render(
    <Provider store={store}>
      <CloudRules
        namespaces={[]}
        expandAll={false}
        rulesSources={{ items: [toRulesSourceDataSource(dataSource)], isLoading: false, ...rulesSources }}
      />
    </Provider>
  );
}

describe('CloudRules — Mimir AM auto-sync', () => {
  beforeEach(() => {
    grantUserRole(OrgRole.Admin);
    grantUserPermissions([
      // Both grafana-managed perms are required to enable canMigrateToGMA.
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingProvisioningSetStatus,
      // Read access to the sync Config, so a reinstated gate would resolve rather than fail open.
      AccessControlAction.ActionAlertingNotificationsConfigRead,
    ]);
  });

  describe('with alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

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

describe('CloudRules — rules source list', () => {
  it('says that no data sources are configured when the list is empty', () => {
    renderWithCloudResults({ items: [] });

    expect(screen.getByText('There are no Prometheus or Loki data sources configured')).toBeInTheDocument();
  });

  it('does not say that no data sources are configured while the list loads', () => {
    renderWithCloudResults({ items: [], isLoading: true });

    expect(screen.queryByText('There are no Prometheus or Loki data sources configured')).not.toBeInTheDocument();
  });

  it('does not say that no data sources are configured when the list fails to load', () => {
    renderWithCloudResults({ items: [], error: new Error('Failed to fetch') });

    expect(screen.queryByText('There are no Prometheus or Loki data sources configured')).not.toBeInTheDocument();
  });
});
