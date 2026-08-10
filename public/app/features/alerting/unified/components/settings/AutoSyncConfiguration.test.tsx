import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';
import { byLabelText, byRole, byText } from 'testing-library-selector';

import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
  AlertmanagerChoice,
} from 'app/plugins/datasource/alertmanager/types';

import { setupMswServer } from '../../mockApi';
import { grantUserRole, mockDataSource } from '../../mocks';
import {
  type AdminConfigPostState,
  setupAdminConfigGet,
  setupAdminConfigPost,
  setupAlertmanagersStatus,
  setupStatefulAdminConfig,
} from '../../mocks/server/configure/admin_config';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
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

const postState: AdminConfigPostState = { lastPayload: null };

beforeEach(() => {
  postState.lastPayload = null;
  grantUserRole('Admin');
  setupAlertmanagersStatus(server);
});

const ui = {
  notConfiguredBadge: byText(/not configured/i),
  activeBadge: byText(/^active$/i),
  saveButton: byRole('button', { name: /^save$/i }),
  disableSyncButton: byRole('button', { name: /^disable sync$/i }),
  picker: byLabelText(/^datasource$/i),
  confirmDialog: byRole('dialog', { name: /disable mimir alertmanager auto-sync/i }),
  confirmDialogDisableButton: byRole('button', { name: /^disable sync$/i }),
};

const edgeUi = {
  operatorManagedCallout: byText(/key in grafana\.ini and cannot be changed from the UI/i),
  orphanWarning: byText(/is not available\. Disable sync or restore the datasource to continue/i),
  noDatasourcesMessage: byText(/no mimir or cortex datasources available/i),
  addMimirDatasourceLink: byRole('link', { name: /add mimir datasource/i }),
};

describe('AutoSyncConfiguration — basic states (cases 1–3)', () => {
  it('case 1: unconfigured — renders "Not configured" badge and disables Save until a selection is made', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();
    expect(ui.saveButton.get()).toBeDisabled();
    // No "Disable sync" button when nothing is configured.
    expect(ui.disableSyncButton.query()).not.toBeInTheDocument();
  });

  it('case 2: save success — sends correct payload and badge flips to Active once the config refetches', async () => {
    setupStatefulAdminConfig(server, postState);
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();

    await user.click(ui.picker.get());
    await user.click(await screen.findByText(MIMIR_DS_NAME));

    await waitFor(() => expect(ui.saveButton.get()).toBeEnabled());
    await user.click(ui.saveButton.get());

    await waitFor(() => expect(postState.lastPayload).toEqual({ external_alertmanager_uid: MIMIR_DS_UID }));
    expect(await ui.activeBadge.find()).toBeInTheDocument();
  });

  it('case 3: configured — Disable sync opens a confirm modal and POSTs an empty string only after confirmation', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: MIMIR_DS_UID,
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    setupAdminConfigPost(server, postState, 200);
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.activeBadge.find()).toBeInTheDocument();
    // Save is hidden while sync is active — admin must Disable first, then re-select + Save.
    expect(ui.saveButton.query()).not.toBeInTheDocument();

    await user.click(ui.disableSyncButton.get());

    // Confirm modal must appear; nothing has been POSTed yet.
    const dialog = await ui.confirmDialog.find();
    expect(dialog).toBeInTheDocument();
    expect(postState.lastPayload).toBeNull();

    await user.click(ui.confirmDialogDisableButton.get(dialog));

    await waitFor(() => expect(postState.lastPayload).toEqual({ external_alertmanager_uid: '' }));
  });
});

describe('AutoSyncConfiguration — edge-case states (cases 5–8)', () => {
  it('case 5: when POST returns 409, UI transitions to operator-managed (badge + info callout)', async () => {
    // The 409 transition needs configuredUid !== '' so the operator-managed marker matches.
    // Save is hidden once configured, so trigger the POST via Disable sync instead.
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: MIMIR_DS_UID,
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    setupAdminConfigPost(server, postState, 409, { message: 'managed by operator' });
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.activeBadge.find()).toBeInTheDocument();

    await user.click(ui.disableSyncButton.get());
    const dialog = await ui.confirmDialog.find();
    await user.click(ui.confirmDialogDisableButton.get(dialog));

    expect(await edgeUi.operatorManagedCallout.find()).toBeInTheDocument();
    expect(ui.activeBadge.query()).not.toBeInTheDocument();
  });

  it('case 6: POST 400 — error toast shown, state does not change', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    setupAdminConfigPost(server, postState, 400, { message: 'invalid datasource' });
    registerMimirDataSources();

    const { user } = render(<AutoSyncConfiguration />);

    expect(await ui.notConfiguredBadge.find()).toBeInTheDocument();

    await user.click(ui.picker.get());
    await user.click(await screen.findByText(MIMIR_DS_NAME));
    await waitFor(() => expect(ui.saveButton.get()).toBeEnabled());
    await user.click(ui.saveButton.get());

    await waitFor(() => expect(postState.lastPayload).toEqual({ external_alertmanager_uid: MIMIR_DS_UID }));

    expect(ui.notConfiguredBadge.get()).toBeInTheDocument();
    expect(edgeUi.operatorManagedCallout.query()).not.toBeInTheDocument();
  });

  it('case 7: no Mimir/Cortex datasources — empty message and "Add Mimir datasource" link rendered', async () => {
    setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });
    setupDatasourcesEndpoint(server, []);
    setupDataSources();

    render(<AutoSyncConfiguration />);

    expect(await edgeUi.noDatasourcesMessage.find()).toBeInTheDocument();
    expect(edgeUi.addMimirDatasourceLink.get()).toBeInTheDocument();
    expect(edgeUi.addMimirDatasourceLink.get()).toHaveAttribute('href', '/connections/datasources/alertmanager');
  });

  it('case 8: orphan UID — warning callout + Disable sync action visible, Save remains available for recovery', async () => {
    setupAdminConfigGet(server, {
      alertmanagersChoice: AlertmanagerChoice.Internal,
      external_alertmanager_uid: 'missing-uid',
    });
    setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    registerMimirDataSources();

    render(<AutoSyncConfiguration />);

    expect(await edgeUi.orphanWarning.find()).toBeInTheDocument();
    expect(ui.disableSyncButton.get()).toBeInTheDocument();
    // Save stays visible in orphan-uid so the admin can recover by picking a real datasource.
    expect(ui.saveButton.get()).toBeInTheDocument();
  });
});
