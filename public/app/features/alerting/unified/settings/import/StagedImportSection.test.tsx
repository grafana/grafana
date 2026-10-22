import { HttpResponse, http } from 'msw';
import { render, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byLabelText, byRole, byText } from 'testing-library-selector';

import { type AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { convertToGMAApi } from '../../api/convertToGMAApi';
import { setupGrafanaManagedServer } from '../../components/settings/mocks/server';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole } from '../../mocks';
import { mimirAlertmanagerDataSourcePayload, setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
import {
  SYNC_SUCCEEDED_CONDITION,
  setupAutoSyncConfig,
  setupStatefulAutoSyncConfig,
} from '../../mocks/server/handlers/k8s/config.k8s';
import { setupDataSources } from '../../testSetup/datasources';

import { StagedImportSection } from './StagedImportSection';
import { type StagedExtraConfig } from './stagedConfig';

const server = setupMswServer();

const AM_CONFIG_URL = '/api/alertmanager/:name/config/api/v1/alerts';
const CONVERT_URL = '/api/convert/api/v1/alerts';

const stagedAlertmanagerConfig = 'route:\n  receiver: default\nreceivers:\n  - name: default\n';

const stagedConfig: StagedExtraConfig = {
  identifier: 'prometheus-prod',
  alertmanager_config: stagedAlertmanagerConfig,
  template_files: {},
  managed_by: 'manual',
};

const SYNC_DATASOURCE_UID = 'mimir-ds-uid';

/** A staged config the syncer owns: the backend keys its own extra_config by the datasource UID. */
const syncOwnedConfig: StagedExtraConfig = {
  ...stagedConfig,
  identifier: SYNC_DATASOURCE_UID,
  managed_by: 'auto-sync',
};

const STOPPED_SYNC_IDENTIFIER = 'devenv-mimir';

/** The copy a sync leaves behind once it is turned off: no longer marked as auto-sync. */
const stoppedSyncCopy: StagedExtraConfig = {
  ...stagedConfig,
  identifier: STOPPED_SYNC_IDENTIFIER,
  managed_by: 'manual',
};

/** A staged config from a backend that predates the managed_by field. */
const legacyStagedConfig: StagedExtraConfig = {
  identifier: stagedConfig.identifier,
  alertmanager_config: stagedConfig.alertmanager_config,
  template_files: stagedConfig.template_files,
};

const ui = {
  loading: byText(/loading imported configurations/i),
  stagedTitle: byText(/^staged configuration$/i),
  autoSyncCard: byRole('region', { name: /auto-sync configuration/i }),
  stagedConfigHeading: byRole('heading', { name: 'prometheus-prod' }),
  syncedConfigHeading: byRole('heading', { name: SYNC_DATASOURCE_UID }),
  revertButton: byRole('button', { name: /^revert$/i }),
  syncedBadge: byText(/synced · read-only/i),
  pendingBadge: byText(/pending first sync/i),
  waitingForFirstSync: byText(/waiting for the first sync/i),
  syncDatasourcePicker: byLabelText(/^datasource$/i),
  disableSyncButton: byRole('button', { name: /^disable sync$/i }),
  promoteButton: byRole('button', { name: /^promote$/i }),
  stagedConflict: byText(/auto-sync is not running/i),
  stoppedBadge: byText(/^sync stopped$/i),
  enableSyncButton: byRole('button', { name: /^enable sync$/i }),
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

/** The section renders nothing once loaded with nothing staged, so wait for its loading state to go. */
async function waitForStagedConfigToLoad() {
  await waitFor(() => expect(ui.loading.query()).not.toBeInTheDocument());
}

describe('Staged import section', () => {
  beforeEach(() => {
    grantUserRole('ServerAdmin');
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
    setupGrafanaManagedServer(server);
    // DataSourcePicker (auto-sync) reads from getDataSourceSrv(); initialise it.
    setupDataSources();
  });

  it('shows nothing while no configuration is staged', async () => {
    render(<StagedImportSection />);

    await waitForStagedConfigToLoad();
    expect(ui.stagedTitle.query()).not.toBeInTheDocument();
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
    render(<StagedImportSection />, { store });

    // The pre-import config is now cached — this is the cache the wizard lands back on after an import.
    await waitForStagedConfigToLoad();

    // Stage a config the way the wizard does. Driven through the store rather than the UI to keep the
    // wizard out of this test.
    await store.dispatch(
      convertToGMAApi.endpoints.convertAlertmanagerConfig.initiate({
        alertmanagerConfig: stagedAlertmanagerConfig,
        configIdentifier: stagedConfig.identifier,
        forceReplace: true,
      })
    );

    expect(await ui.stagedConfigHeading.find()).toBeInTheDocument();
  });

  describe('with alerting.syncExternalAlertmanager enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    // Turning sync on from scratch is an option of the wizard's notifications step.
    it('shows no auto-sync setup card while sync is not set up', async () => {
      render(<StagedImportSection />);

      await waitForStagedConfigToLoad();
      expect(ui.autoSyncCard.query()).not.toBeInTheDocument();
      expect(ui.stagedTitle.query()).not.toBeInTheDocument();
    });

    describe('while sync is set up', () => {
      beforeEach(() => {
        grantUserPermissions([
          AccessControlAction.AlertingNotificationsRead,
          AccessControlAction.ActionAlertingNotificationsConfigRead,
        ]);
        setupDatasourcesEndpoint(server, [mimirAlertmanagerDataSourcePayload({ uid: SYNC_DATASOURCE_UID })]);
      });

      it('shows the sync and its synced copy in one card', async () => {
        setupAutoSyncConfig(server, {
          specUid: SYNC_DATASOURCE_UID,
          statusUid: SYNC_DATASOURCE_UID,
          condition: SYNC_SUCCEEDED_CONDITION,
        });
        serveStagedConfig(syncOwnedConfig);

        render(<StagedImportSection />);

        expect(await ui.syncedBadge.find()).toBeInTheDocument();
        // The separate auto-sync setting card is folded into the staged card.
        expect(ui.autoSyncCard.query()).not.toBeInTheDocument();
        expect(ui.syncDatasourcePicker.get()).toBeDisabled();
        expect(ui.disableSyncButton.get()).toBeInTheDocument();
        expect(ui.promoteButton.get()).toBeInTheDocument();
        expect(ui.revertButton.query()).not.toBeInTheDocument();
      });

      it('shows the sync as pending before its first copy lands', async () => {
        setupAutoSyncConfig(server, { specUid: SYNC_DATASOURCE_UID });

        render(<StagedImportSection />);

        expect(await ui.pendingBadge.find()).toBeInTheDocument();
        expect(ui.waitingForFirstSync.get()).toBeInTheDocument();
        expect(ui.disableSyncButton.get()).toBeInTheDocument();
        // Nothing to promote yet.
        expect(ui.promoteButton.query()).not.toBeInTheDocument();
      });

      it('keeps another staged import in its own card and says it blocks the sync', async () => {
        setupAutoSyncConfig(server, { specUid: SYNC_DATASOURCE_UID });
        serveStagedConfig(stagedConfig);

        render(<StagedImportSection />);

        expect(await ui.stagedConflict.find()).toBeInTheDocument();
        expect(ui.stagedConfigHeading.get()).toBeInTheDocument();
        expect(ui.revertButton.get()).toBeInTheDocument();
      });
    });

    describe('after sync is turned off with its copy still staged', () => {
      beforeEach(() => {
        grantUserPermissions([
          AccessControlAction.AlertingNotificationsRead,
          AccessControlAction.ActionAlertingNotificationsConfigRead,
        ]);
        setupDatasourcesEndpoint(server, [mimirAlertmanagerDataSourcePayload({ uid: SYNC_DATASOURCE_UID })]);
        // Once sync is off the backend marks its leftover copy as manual; only the status ties it to the sync.
        serveStagedConfig(stoppedSyncCopy);
      });

      it('keeps the one-card layout, with the copy revertable and sync ready to turn back on', async () => {
        setupAutoSyncConfig(server, { statusUid: SYNC_DATASOURCE_UID, statusIdentifier: STOPPED_SYNC_IDENTIFIER });

        render(<StagedImportSection />);

        expect(await ui.stoppedBadge.find()).toBeInTheDocument();
        expect(ui.autoSyncCard.query()).not.toBeInTheDocument();
        expect(ui.syncedBadge.query()).not.toBeInTheDocument();
        expect(ui.syncDatasourcePicker.get()).toBeEnabled();
        expect(ui.revertButton.get()).toBeInTheDocument();
        expect(ui.promoteButton.get()).toBeInTheDocument();
        expect(ui.enableSyncButton.get()).toBeEnabled();
      });

      it('shows a manual import the sync did not make as an ordinary staged copy', async () => {
        setupAutoSyncConfig(server, { statusUid: SYNC_DATASOURCE_UID, statusIdentifier: STOPPED_SYNC_IDENTIFIER });
        serveStagedConfig(stagedConfig);

        render(<StagedImportSection />);

        expect(await ui.stagedConfigHeading.find()).toBeInTheDocument();
        expect(ui.revertButton.get()).toBeInTheDocument();
        expect(ui.stoppedBadge.query()).not.toBeInTheDocument();
      });

      it('turns sync back on for the datasource the copy came from', async () => {
        const { getStored } = setupStatefulAutoSyncConfig(server, {
          statusUid: SYNC_DATASOURCE_UID,
          statusIdentifier: STOPPED_SYNC_IDENTIFIER,
        });

        const { user } = render(<StagedImportSection />);

        await user.click(await ui.enableSyncButton.find());

        await waitFor(() =>
          expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: SYNC_DATASOURCE_UID })
        );
        expect(await ui.disableSyncButton.find()).toBeInTheDocument();
      });
    });

    describe('sync ownership of the staged card', () => {
      it('marks the staged card as synced when managed_by is auto-sync', async () => {
        serveStagedConfig(syncOwnedConfig);

        render(<StagedImportSection />);

        expect(await ui.syncedConfigHeading.find()).toBeInTheDocument();
        expect(ui.syncedBadge.get()).toBeInTheDocument();
        expect(ui.revertButton.query()).not.toBeInTheDocument();
      });

      it('keeps revert available when managed_by is manual', async () => {
        serveStagedConfig(stagedConfig);

        render(<StagedImportSection />);

        expect(await ui.stagedConfigHeading.find()).toBeInTheDocument();
        expect(ui.revertButton.get()).toBeInTheDocument();
      });

      it('keeps revert available when managed_by is absent (pre-rollout backend)', async () => {
        serveStagedConfig(legacyStagedConfig);

        render(<StagedImportSection />);

        expect(await ui.stagedConfigHeading.find()).toBeInTheDocument();
        expect(ui.revertButton.get()).toBeInTheDocument();
      });
    });
  });
});
