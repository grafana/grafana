import { screen, waitFor } from '@testing-library/react';
import { render, testWithFeatureToggles } from 'test/test-utils';
import { byLabelText, byRole, byText } from 'testing-library-selector';

import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole, mockDataSource } from '../../mocks';
import { setupAlertmanagersStatus } from '../../mocks/server/configure/alertmanagers';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
import {
  CONFIG_READ_FAILURE_MESSAGE,
  setupAutoSyncConfig,
  setupAutoSyncConfigAbsent,
  setupAutoSyncConfigReadError,
  setupAutoSyncConfigWriteError,
  setupStatefulAutoSyncConfig,
} from '../../mocks/server/handlers/k8s/config.k8s';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

import { AutoSyncConfiguration } from './AutoSyncConfiguration';

const server = setupMswServer();

const MIMIR_DS_UID = 'mimir-uid';
const MIMIR_DS_NAME = 'Test Mimir Alertmanager';

const MIMIR_DS_PAYLOAD = {
  id: 1,
  uid: MIMIR_DS_UID,
  orgId: 1,
  name: MIMIR_DS_NAME,
  type: 'alertmanager',
  url: 'http://localhost:9009',
  jsonData: { implementation: 'mimir' },
};

/** A Config whose status reports the configured UID as the last sync target. */
const SYNCED = {
  specUid: MIMIR_DS_UID,
  statusUid: MIMIR_DS_UID,
};

function registerMimirDataSources(datasources: Array<typeof MIMIR_DS_PAYLOAD> = [MIMIR_DS_PAYLOAD]) {
  // DataSourcePicker reads from getDataSourceSrv(), so we register the datasources in the
  // in-memory srv in addition to mocking the HTTP list used by RTK Query.
  // `meta.alerting: true` is required for the picker's default `getList` filter to surface
  // them (see DatasourceSrv.getList).
  setupDataSources(
    ...datasources.map((ds) =>
      mockDataSource<AlertManagerDataSourceJsonData>(
        {
          uid: ds.uid,
          name: ds.name,
          type: DataSourceType.Alertmanager,
          url: ds.url,
          jsonData: { implementation: AlertManagerImplementation.mimir },
        },
        { alerting: true }
      )
    )
  );
}

testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

beforeEach(() => {
  grantUserRole('Admin');
  grantUserPermissions([AccessControlAction.ActionAlertingNotificationsConfigRead]);
  setupAlertmanagersStatus(server);
});

const ui = {
  notConfiguredBadge: byText(/not configured/i),
  activeBadge: byText(/^active$/i),
  saveButton: byRole('button', { name: /^save$/i }),
  disableSyncButton: byRole('button', { name: /^disable sync$/i }),
  picker: byLabelText(/^datasource$/i),
  // Anchored so it cannot also match the save-disabled tooltip, which shares its opening words.
  pickerPlaceholder: byText(/^Select a Mimir or Cortex Alertmanager datasource…$/),
  confirmDialog: byRole('dialog', { name: /disable mimir alertmanager auto-sync/i }),
  confirmDialogDisableButton: byRole('button', { name: /^disable sync$/i }),
};

const edgeUi = {
  initializingTooltip: byText(/Grafana has not finished setting up auto-sync/i),
  operatorManagedCallout: byText(/key in grafana\.ini and cannot be changed from the UI/i),
  orphanWarning: byText(/is not available\. Disable sync or restore the datasource to continue/i),
  noDatasourcesMessage: byText(/no mimir or cortex datasources available/i),
  addMimirDatasourceLink: byRole('link', { name: /add mimir datasource/i }),
};

describe('AutoSyncConfiguration — basic states (cases 1–3)', () => {
  it('case 1: unconfigured — renders "Not configured" badge and disables Save until a selection is made', async () => {
    setupAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();
    expect(ui.saveButton.get()).toBeDisabled();
    // No "Disable sync" button when nothing is configured.
    expect(ui.disableSyncButton.query()).not.toBeInTheDocument();
  });

  it('case 2: save success — writes the UID to spec and the badge flips to Active once the Config refetches', async () => {
    const { getStored } = setupStatefulAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();

    await user.click(ui.picker.get());
    await user.click(await screen.findByText(MIMIR_DS_NAME));

    await waitFor(() => expect(ui.saveButton.get()).toBeEnabled());
    await user.click(ui.saveButton.get());

    await waitFor(() => expect(getStored().spec.externalAlertmanagerSync).toEqual({ datasourceUid: MIMIR_DS_UID }));
    expect(await ui.activeBadge.find()).toBeInTheDocument();
  });

  it('case 3: configured — Disable sync opens a confirm modal and clears the UID only after confirmation', async () => {
    const { patchSpy, getStored } = setupStatefulAutoSyncConfig(server, SYNCED);
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.activeBadge.find()).toBeInTheDocument();
    // Save is hidden while sync is active — admin must Disable first, then re-select + Save.
    expect(ui.saveButton.query()).not.toBeInTheDocument();

    await user.click(ui.disableSyncButton.get());

    // Confirm modal must appear; nothing has been written yet.
    const dialog = await ui.confirmDialog.find();
    expect(dialog).toBeInTheDocument();
    expect(patchSpy).not.toHaveBeenCalled();

    await user.click(ui.confirmDialogDisableButton.get(dialog));

    // Cleared, not deleted: delete is unconditionally denied on the singleton.
    await waitFor(() => expect(getStored().spec.externalAlertmanagerSync).toEqual({}));
  });
});

describe('AutoSyncConfiguration — edge-case states', () => {
  it('case 5: operator-managed is detected on load from status origin=ini (badge + info callout)', async () => {
    // Previously this state was only reachable after a save failed with 409. Reading it from status
    // means the picker is correctly locked before the user attempts anything.
    setupAutoSyncConfig(server, { statusUid: MIMIR_DS_UID, origin: 'ini' });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    render(<AutoSyncConfiguration />);

    expect(await edgeUi.operatorManagedCallout.find()).toBeInTheDocument();
    expect(ui.activeBadge.query()).not.toBeInTheDocument();
    expect(await ui.picker.find()).toBeDisabled();
  });

  it('case 5b: a removed ini key releases the lock, which is what the callout tells the admin to do', async () => {
    // origin stays 'ini' after the key is removed, so trusting it alone left the admin with a locked
    // picker, no Save and no Disable — permanently.
    setupAutoSyncConfig(server, { statusUid: MIMIR_DS_UID, origin: 'ini', syncedReason: 'NotConfigured' });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();
    expect(edgeUi.operatorManagedCallout.query()).not.toBeInTheDocument();
    expect(ui.picker.get()).toBeEnabled();
    expect(ui.saveButton.get()).toBeInTheDocument();
  });

  it('case 6: rejected write — state does not change and operator-managed is not inferred', async () => {
    setupStatefulAutoSyncConfig(server);
    setupAutoSyncConfigWriteError(server, { code: 403, message: 'datasource must be of type alertmanager' });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();

    await user.click(ui.picker.get());
    await user.click(await screen.findByText(MIMIR_DS_NAME));
    await waitFor(() => expect(ui.saveButton.get()).toBeEnabled());
    await user.click(ui.saveButton.get());

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();
    expect(edgeUi.operatorManagedCallout.query()).not.toBeInTheDocument();
  });

  it('case 7: no Mimir/Cortex datasources — empty message and "Add Mimir datasource" link rendered', async () => {
    setupAutoSyncConfig(server);
    setupDatasourcesEndpoint(server, []);
    setupDataSources();

    render(<AutoSyncConfiguration />);

    expect(await edgeUi.noDatasourcesMessage.find()).toBeInTheDocument();
    expect(edgeUi.addMimirDatasourceLink.get()).toBeInTheDocument();
    expect(edgeUi.addMimirDatasourceLink.get()).toHaveAttribute('href', '/connections/datasources/alertmanager');
  });

  it('case 8: orphan UID — warning callout + Disable sync action visible, Save remains available for recovery', async () => {
    setupAutoSyncConfig(server, { specUid: 'missing-uid' });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    render(<AutoSyncConfiguration />);

    expect(await edgeUi.orphanWarning.find()).toBeInTheDocument();
    expect(ui.disableSyncButton.get()).toBeInTheDocument();
    // Save stays visible in orphan-uid so the admin can recover by picking a real datasource.
    expect(ui.saveButton.get()).toBeInTheDocument();
  });

  it('case 10: unseeded singleton — reads as unconfigured and keeps Save disabled even once a datasource is picked', async () => {
    // The sync worker seeds the singleton on its first tick; humans cannot create it. Save must stay
    // disabled until then, otherwise the click fails with a "still initializing" toast.
    setupAutoSyncConfigAbsent(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();
    expect(ui.pickerPlaceholder.get()).toBeInTheDocument();

    await user.click(ui.picker.get());
    await user.click(await screen.findByText(MIMIR_DS_NAME));

    // Prove the selection landed before checking the disabled state, so this cannot pass for the
    // wrong reason: the placeholder is only replaced once the picker holds a value.
    expect(ui.pickerPlaceholder.query()).not.toBeInTheDocument();
    expect(ui.saveButton.get()).toBeDisabled();
  });

  it('case 11: unseeded singleton — the Save tooltip tells the admin the wait is temporary', async () => {
    setupAutoSyncConfigAbsent(server);
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();
    // Absent until hovered, so the assertion below cannot pass on always-rendered copy.
    expect(edgeUi.initializingTooltip.query()).not.toBeInTheDocument();

    await user.hover(ui.saveButton.get());

    expect(await edgeUi.initializingTooltip.find()).toBeInTheDocument();
  });

  it('case 12: failed Config read — the Save tooltip carries the reason instead of promising a wait', async () => {
    // Waiting fixes a 404, not a 500, and nothing else surfaces this one: the k8s base query raises no
    // error alert of its own. Asserting the whole string also proves the quoted resource name survived
    // i18n interpolation instead of arriving as `&quot;default&quot;`.
    setupAutoSyncConfigReadError(server, { code: 500 });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();
    expect(ui.saveButton.get()).toBeDisabled();
    expect(screen.queryByText(/could not load the auto-sync configuration/i)).not.toBeInTheDocument();

    await user.hover(ui.saveButton.get());

    expect(
      await screen.findByText(`Could not load the auto-sync configuration: ${CONFIG_READ_FAILURE_MESSAGE}`)
    ).toBeInTheDocument();
    expect(edgeUi.initializingTooltip.query()).not.toBeInTheDocument();
  });
});
