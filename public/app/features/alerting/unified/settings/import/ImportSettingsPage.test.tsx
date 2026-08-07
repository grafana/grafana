import { HttpResponse, http } from 'msw';
import { act, render, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { type AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { convertToGMAApi } from '../../api/convertToGMAApi';
import { setupGrafanaManagedServer } from '../../components/settings/mocks/server';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole } from '../../mocks';
import { setupAutoSyncConfig } from '../../mocks/server/handlers/k8s/config.k8s';
import { setupDataSources } from '../../testSetup/datasources';

import ImportSettingsPage from './ImportSettingsPage';
import { type StagedExtraConfig } from './stagedConfig';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));

const server = setupMswServer();

const AM_CONFIG_URL = '/api/alertmanager/:name/config/api/v1/alerts';
const CONVERT_URL = '/api/convert/api/v1/alerts';
const CONFIG_SINGLETON_URL = '/apis/notifications.alerting.grafana.app/v0alpha1/namespaces/:namespace/configs/:name';

const stagedAlertmanagerConfig = 'route:\n  receiver: default\nreceivers:\n  - name: default\n';

const stagedConfig: StagedExtraConfig = {
  identifier: 'prometheus-prod',
  alertmanager_config: stagedAlertmanagerConfig,
  template_files: {},
};

const SYNC_DATASOURCE_UID = 'mimir-ds-uid';

/** A staged config the syncer owns: the backend keys its own extra_config by the datasource UID. */
const syncOwnedConfig: StagedExtraConfig = { ...stagedConfig, identifier: SYNC_DATASOURCE_UID };

const ui = {
  loading: byText(/loading imported configurations/i),
  autoSyncCard: byRole('region', { name: /auto-sync configuration/i }),
  emptyState: byText(/no configuration imported yet/i),
  importCta: byRole('link', { name: /import alertmanager configuration/i }),
  learnMoreLink: byRole('link', { name: /learn more about importing configurations/i }),
  stagedConfigHeading: byRole('heading', { name: 'prometheus-prod' }),
  syncedConfigHeading: byRole('heading', { name: SYNC_DATASOURCE_UID }),
  revertButton: byRole('button', { name: /^revert$/i }),
  syncedBadge: byText(/synced · read-only/i),
};

function serveStagedConfig(staged: StagedExtraConfig) {
  server.use(
    http.get(AM_CONFIG_URL, () =>
      HttpResponse.json<AlertManagerCortexConfig>({
        alertmanager_config: {},
        template_files: {},
        extra_config: [staged],
      })
    )
  );
}

describe('Import settings tab', () => {
  beforeEach(() => {
    grantUserRole('ServerAdmin');
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
    setupGrafanaManagedServer(server);
    // DataSourcePicker (auto-sync) reads from getDataSourceSrv(); initialise it.
    setupDataSources();
  });

  it('shows the empty state with an import CTA and learn-more link when no configuration is staged', async () => {
    render(<ImportSettingsPage />);

    expect(await ui.emptyState.find()).toBeInTheDocument();
    expect(ui.importCta.get()).toBeInTheDocument();
    expect(ui.learnMoreLink.get()).toBeInTheDocument();
  });

  it('shows a configuration staged after it was already rendered as empty', async () => {
    let isStaged = false;
    server.use(
      // The staged config is carried on extra_config, so it only appears once an import has staged it.
      http.get(AM_CONFIG_URL, () =>
        HttpResponse.json<AlertManagerCortexConfig>({
          alertmanager_config: {},
          template_files: {},
          extra_config: isStaged ? [stagedConfig] : undefined,
        })
      ),
      http.post(CONVERT_URL, () => {
        isStaged = true;
        return HttpResponse.json({ status: 'success' });
      })
    );

    const store = configureStore();
    render(<ImportSettingsPage />, { store });

    // The pre-import config is now cached — this is the cache the wizard's redirect lands back on.
    expect(await ui.emptyState.find()).toBeInTheDocument();

    // Stage a config the way the wizard does. Driven through the store rather than the UI because the
    // wizard that triggers this mutation lives on another page.
    await store.dispatch(
      convertToGMAApi.endpoints.convertAlertmanagerConfig.initiate({
        alertmanagerConfig: stagedAlertmanagerConfig,
        configIdentifier: stagedConfig.identifier,
        forceReplace: true,
      })
    );

    expect(await ui.stagedConfigHeading.find()).toBeInTheDocument();
    expect(ui.emptyState.query()).not.toBeInTheDocument();
  });

  it('does not render the relocated auto-sync card when the sync flag is off', async () => {
    render(<ImportSettingsPage />);

    await ui.emptyState.find();
    expect(ui.autoSyncCard.query()).not.toBeInTheDocument();
  });

  describe('with alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    it('renders the relocated auto-sync card', async () => {
      render(<ImportSettingsPage />);

      expect(await ui.autoSyncCard.find()).toBeInTheDocument();
    });

    describe('sync ownership of the staged card', () => {
      beforeEach(() => {
        // Ownership is read from the Config singleton, which needs the scoped config:get permission.
        grantUserPermissions([
          AccessControlAction.AlertingNotificationsRead,
          AccessControlAction.ActionAlertingNotificationsConfigRead,
        ]);
      });

      it('marks the staged card as synced when its identifier matches the synced datasource', async () => {
        serveStagedConfig(syncOwnedConfig);
        setupAutoSyncConfig(server, { specUid: SYNC_DATASOURCE_UID });

        render(<ImportSettingsPage />);

        expect(await ui.syncedConfigHeading.find()).toBeInTheDocument();
        expect(ui.syncedBadge.get()).toBeInTheDocument();
        expect(ui.revertButton.query()).not.toBeInTheDocument();
      });

      // The operator ini override (unified_alerting.external_alertmanager_uid) never reaches spec, so
      // ownership has to be read off status or the card offers a Revert the next tick would undo.
      it('marks the staged card as synced when an ini-configured sync owns it', async () => {
        serveStagedConfig(syncOwnedConfig);
        setupAutoSyncConfig(server, { statusUid: SYNC_DATASOURCE_UID, statusOrigin: 'ini' });

        render(<ImportSettingsPage />);

        expect(await ui.syncedConfigHeading.find()).toBeInTheDocument();
        expect(ui.syncedBadge.get()).toBeInTheDocument();
        expect(ui.revertButton.query()).not.toBeInTheDocument();
      });

      it('keeps revert available for a manual import while sync runs against another datasource', async () => {
        serveStagedConfig(stagedConfig);
        setupAutoSyncConfig(server, { specUid: SYNC_DATASOURCE_UID });

        render(<ImportSettingsPage />);

        expect(await ui.stagedConfigHeading.find()).toBeInTheDocument();
        expect(ui.revertButton.get()).toBeInTheDocument();
      });

      // Ownership resolves independently of the Alertmanager config, so the card must wait for it —
      // otherwise an unresolved query reads as "not sync-managed" and offers a Revert that the next
      // sync tick would immediately undo.
      it('does not offer revert before sync ownership is known', async () => {
        const amConfigServed = jest.fn();
        let resolveOwnership = () => {};
        const ownershipResolved = new Promise<void>((resolve) => {
          resolveOwnership = resolve;
        });

        server.use(
          http.get(AM_CONFIG_URL, () => {
            amConfigServed();
            return HttpResponse.json<AlertManagerCortexConfig>({
              alertmanager_config: {},
              template_files: {},
              extra_config: [syncOwnedConfig],
            });
          }),
          http.get(CONFIG_SINGLETON_URL, async () => {
            await ownershipResolved;
            return HttpResponse.json({
              apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
              kind: 'Config',
              metadata: { name: 'default' },
              spec: { externalAlertmanagerSync: { datasourceUid: SYNC_DATASOURCE_UID } },
            });
          })
        );

        render(<ImportSettingsPage />);

        // Let the Alertmanager config land while ownership is still in flight — the window in which the
        // card would otherwise render as a plain staged import.
        await waitFor(() => expect(amConfigServed).toHaveBeenCalled());
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(ui.loading.get()).toBeInTheDocument();
        expect(ui.revertButton.query()).not.toBeInTheDocument();
        expect(ui.syncedConfigHeading.query()).not.toBeInTheDocument();

        resolveOwnership();

        expect(await ui.syncedConfigHeading.find()).toBeInTheDocument();
        expect(ui.revertButton.query()).not.toBeInTheDocument();
      });
    });
  });
});
