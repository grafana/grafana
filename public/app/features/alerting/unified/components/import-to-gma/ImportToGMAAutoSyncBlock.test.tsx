import { HttpResponse, http } from 'msw';
import { act, render, screen, testWithFeatureToggles, waitFor, within } from 'test/test-utils';
import { byPlaceholderText, byRole, byTestId, byText } from 'testing-library-selector';

import { OrgRole } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole, mockDataSource } from '../../mocks';
import { mimirAlertmanagerDataSourcePayload, setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
import {
  SYNC_SUCCEEDED_CONDITION,
  setupAutoSyncConfig,
  setupStatefulAutoSyncConfig,
} from '../../mocks/server/handlers/k8s/config.k8s';
import { type StagedExtraConfig } from '../../settings/import/stagedConfig';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

import { ImportWizardGate } from './ImportToGMA';

const server = setupMswServer();

const MIMIR_DS_UID = 'mimir-uid';

const AM_CONFIG_URL = '/api/alertmanager/:name/config/api/v1/alerts';

// Auto-sync stages its copy under the datasource UID.
const syncedConfig: StagedExtraConfig = {
  identifier: MIMIR_DS_UID,
  alertmanager_config: 'route:\n  receiver: default\nreceivers:\n  - name: default\n',
  template_files: { 'slack.tmpl': '', 'email.tmpl': '' },
  managed_by: 'auto-sync',
};

/** Serves the Grafana Alertmanager config carrying the given staged config, and counts the requests. */
function serveStagedConfig(staged?: StagedExtraConfig) {
  const requests = { count: 0 };
  server.use(
    http.get(AM_CONFIG_URL, () => {
      requests.count++;
      return HttpResponse.json<AlertManagerCortexConfig>({
        alertmanager_config: {},
        template_files: {},
        extra_config: staged ? [staged] : undefined,
      });
    })
  );
  return requests;
}

// useAutoSyncConfiguration (mounted by the wizard once the gate lets it through) fires this
// unconditionally.
beforeEach(() => {
  setupDatasourcesEndpoint(server, []);
});

// The wizard locks its notifications step unless the Alertmanager import API is on.
beforeEach(() => setTestFlags({ [FlagKeys.AlertingImportAlertmanagerAPI]: true }));
// The reset fires OpenFeature events while components are still mounted, so it needs act.
afterEach(async () => {
  await act(async () => {
    setTestFlags();
  });
});

const ui = {
  blockTitle: byText(/auto-sync is enabled/i),
  importAPIDisabledTitle: byText(/notification configuration import is unavailable/i),
  syncedBadge: byText(/synced · read-only/i),
  pendingBadge: byText(/pending first sync/i),
  pendingDescription: byText(/waiting for the first sync/i),
  importRules: byRole('link', { name: /import alert rules/i }),
  disableSyncHint: byText(/disable sync below to import notification configuration/i),
  stagedTitle: byText(/^staged configuration$/i),
  disableSyncButton: byRole('button', { name: /^disable sync$/i }),
  promoteButton: byRole('button', { name: /^promote$/i }),
  notificationsStep: byRole('group', { name: /import notification configuration/i }),
  rulesStep: byRole('group', { name: /import rules/i }),
  nextButton: byTestId(selectors.pages.Alerting.ImportToGMA.nextButton),
  // The wizard sidebar is the only list on the page.
  stepper: byRole('list'),
  policyTreeNameInput: byPlaceholderText('e.g. prometheus-prod'),
  dataSourceSourceOption: byText(/^data source$/i),
  notificationsDataSourcePlaceholder: byText('Select data source'),
  clearValueButton: byRole('button', { name: /clear value/i }),
  skipButton: byTestId(selectors.pages.Alerting.ImportToGMA.skipButton),
  nothingToImport: byRole('status', { name: /nothing to import/i }),
};

// Read access to the sync Config plus the permissions the wizard itself needs. Note: no admin role —
// the lock must apply to any user allowed to reach the wizard.
function grantWizardPermissions() {
  grantUserPermissions([
    AccessControlAction.ActionAlertingNotificationsConfigRead,
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingProvisioningSetStatus,
  ]);
}

describe('Import wizard auto-sync gate', () => {
  it('renders the wizard normally when the sync feature is off, regardless of config', async () => {
    setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });

    render(<ImportWizardGate />);

    // Flag off -> the sync query is skipped and the wizard renders.
    expect(await ui.notificationsStep.find()).toBeInTheDocument();
    expect(ui.blockTitle.query()).not.toBeInTheDocument();
  });

  describe('when the sync feature is enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    beforeEach(grantWizardPermissions);

    it('locks only the notifications step when auto-sync is active', async () => {
      grantUserRole(OrgRole.Admin);
      setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });

      render(<ImportWizardGate />);

      expect(await ui.notificationsStep.find()).toBeInTheDocument();
      expect(ui.blockTitle.get()).toBeInTheDocument();
      expect(ui.disableSyncHint.get()).toBeInTheDocument();
      // The locked step has nothing to skip, it only offers to continue.
      expect(ui.nextButton.get()).toHaveAttribute('aria-disabled', 'false');
      expect(ui.skipButton.query()).not.toBeInTheDocument();
      // Rule import happens in the wizard itself, so there is no link out to the old import page.
      expect(ui.importRules.query()).not.toBeInTheDocument();
    });

    describe('showing the synced configuration', () => {
      beforeEach(() => {
        grantUserRole(OrgRole.Admin);
        grantUserPermissions([
          AccessControlAction.ActionAlertingNotificationsConfigRead,
          AccessControlAction.AlertingRuleCreate,
          AccessControlAction.AlertingProvisioningSetStatus,
          AccessControlAction.AlertingNotificationsRead,
          AccessControlAction.AlertingNotificationsWrite,
        ]);
        setupDatasourcesEndpoint(server, [mimirAlertmanagerDataSourcePayload({ uid: MIMIR_DS_UID })]);
        setupDataSources();
      });

      it('shows the synced copy with the controls to stop the sync or promote the copy', async () => {
        setupAutoSyncConfig(server, {
          specUid: MIMIR_DS_UID,
          statusUid: MIMIR_DS_UID,
          condition: SYNC_SUCCEEDED_CONDITION,
        });
        serveStagedConfig(syncedConfig);

        render(<ImportWizardGate />);

        expect(await ui.syncedBadge.find()).toBeInTheDocument();
        expect(ui.blockTitle.get()).toBeInTheDocument();
        expect(ui.disableSyncButton.get()).toBeInTheDocument();
        expect(ui.promoteButton.get()).toBeInTheDocument();
      });

      it('shows the sync as pending while nothing has synced yet', async () => {
        setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });
        serveStagedConfig(undefined);

        render(<ImportWizardGate />);

        expect(await ui.pendingBadge.find()).toBeInTheDocument();
        expect(ui.pendingDescription.get()).toBeInTheDocument();
        expect(ui.promoteButton.query()).not.toBeInTheDocument();
      });

      it('unlocks the notifications step once sync is disabled from the card', async () => {
        setupStatefulAutoSyncConfig(server, {
          specUid: MIMIR_DS_UID,
          statusUid: MIMIR_DS_UID,
          condition: SYNC_SUCCEEDED_CONDITION,
        });
        serveStagedConfig(syncedConfig);

        const { user } = render(<ImportWizardGate />);

        await user.click(await ui.disableSyncButton.find());
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /^disable sync$/i }));

        await waitFor(() => expect(ui.blockTitle.query()).not.toBeInTheDocument());
        expect(ui.notificationsStep.get()).toBeInTheDocument();
        // The copy the sync left behind is still staged, ready to promote or revert.
        expect(ui.stagedTitle.get()).toBeInTheDocument();
      });
    });

    it('lets the user continue to the rules step when auto-sync is active', async () => {
      grantUserRole(OrgRole.Viewer);
      setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });
      // The rules step renders a data source picker.
      setupDataSources();

      const { user } = render(<ImportWizardGate />);

      expect(await ui.blockTitle.find()).toBeInTheDocument();
      await user.click(ui.nextButton.get());

      expect(await ui.rulesStep.find()).toBeInTheDocument();

      // Nothing from the locked step reaches the import: with the rules skipped too, there is nothing left.
      // Without a rules source, the step's single button skips.
      expect(ui.nextButton.get()).toHaveTextContent(/^skip$/i);
      await user.click(ui.nextButton.get());
      expect(await ui.nothingToImport.find()).toBeInTheDocument();
    });

    it('lets the user jump to the rules step from the sidebar when auto-sync is active', async () => {
      grantUserRole(OrgRole.Viewer);
      setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });
      // The rules step renders a data source picker.
      setupDataSources();

      const { user } = render(<ImportWizardGate />);

      expect(await ui.blockTitle.find()).toBeInTheDocument();
      const sidebarRulesStep = within(ui.stepper.get()).getByRole('button', { name: /rules/i });
      expect(sidebarRulesStep).toBeEnabled();
      await user.click(sidebarRulesStep);

      expect(await ui.rulesStep.find()).toBeInTheDocument();
    });

    it('renders the wizard when auto-sync is not active', async () => {
      setupAutoSyncConfig(server, {});

      render(<ImportWizardGate />);

      expect(await ui.notificationsStep.find()).toBeInTheDocument();
      await waitFor(() => expect(ui.blockTitle.query()).not.toBeInTheDocument());
    });
  });
});

describe('Import wizard with an empty notifications step', () => {
  beforeEach(() => {
    grantWizardPermissions();
    grantUserPermissions([
      AccessControlAction.ActionAlertingNotificationsConfigRead,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingProvisioningSetStatus,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
    // The rules step renders a data source picker.
    setupDataSources();
  });

  it('lets Next move on as a skip while nothing is entered', async () => {
    const { user } = render(<ImportWizardGate />);

    expect(await ui.notificationsStep.find()).toBeInTheDocument();
    // One button, which says what it does: there is nothing to continue with yet.
    expect(ui.nextButton.get()).toHaveTextContent(/^skip$/i);
    expect(ui.skipButton.query()).not.toBeInTheDocument();
    expect(ui.nextButton.get()).toHaveAttribute('aria-disabled', 'false');
    await user.click(ui.nextButton.get());

    expect(await ui.rulesStep.find()).toBeInTheDocument();
  });

  it('lets the user jump to the rules step from the sidebar while nothing is entered', async () => {
    const { user } = render(<ImportWizardGate />);

    expect(await ui.notificationsStep.find()).toBeInTheDocument();
    await user.click(within(ui.stepper.get()).getByRole('button', { name: /rules/i }));

    expect(await ui.rulesStep.find()).toBeInTheDocument();
  });

  it('turns back into Skip when a picked data source is cleared again', async () => {
    setupDataSources(
      mockDataSource(
        { uid: 'mimir-prod-uid', name: 'Mimir Prod', type: DataSourceType.Alertmanager },
        { alerting: true }
      )
    );
    const { user } = render(<ImportWizardGate />);

    expect(await ui.notificationsStep.find()).toBeInTheDocument();
    await user.click(ui.dataSourceSourceOption.get());
    await user.click(await ui.notificationsDataSourcePlaceholder.find());
    await user.click(await screen.findByText('Mimir Prod'));

    // Picking a data source fills in the policy tree name and turns the button into Continue.
    expect(ui.policyTreeNameInput.get()).toHaveValue('mimir-prod');
    expect(ui.nextButton.get()).toHaveTextContent(/^continue$/i);

    await user.click(ui.clearValueButton.get());

    // Clearing takes the name it filled in along with it, so the step is empty again.
    expect(ui.policyTreeNameInput.get()).toHaveValue('');
    await waitFor(() => expect(ui.nextButton.get()).toHaveTextContent(/^skip$/i));
  });

  it('offers to skip an empty rules step too, and lets the sidebar reach the review', async () => {
    const { user } = render(<ImportWizardGate />);

    expect(await ui.notificationsStep.find()).toBeInTheDocument();
    await user.click(ui.nextButton.get());
    expect(await ui.rulesStep.find()).toBeInTheDocument();

    // No rules source chosen yet, so the single button skips.
    expect(ui.nextButton.get()).toHaveTextContent(/^skip$/i);
    expect(ui.skipButton.query()).not.toBeInTheDocument();
    expect(within(ui.stepper.get()).getByRole('button', { name: /review/i })).toBeEnabled();
  });

  it('asks for the step to be completed again once something is entered', async () => {
    const { user } = render(<ImportWizardGate />);

    expect(await ui.notificationsStep.find()).toBeInTheDocument();
    await user.type(ui.policyTreeNameInput.get(), 'mimir-prod');

    await waitFor(() => expect(ui.nextButton.get()).toHaveAttribute('aria-disabled', 'true'));
    expect(within(ui.stepper.get()).getByRole('button', { name: /rules/i })).toBeDisabled();
  });
});

describe('Import wizard without the Alertmanager import API', () => {
  testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

  beforeEach(() => {
    grantWizardPermissions();
    // Runs after the file-level beforeEach, so this turns the import API back off.
    setTestFlags({});
  });

  it('locks the notifications step and explains why', async () => {
    setupAutoSyncConfig(server, {});

    render(<ImportWizardGate />);

    expect(await ui.importAPIDisabledTitle.find()).toBeInTheDocument();
    // The locked step has nothing to skip, it only offers to continue.
    expect(ui.nextButton.get()).toHaveAttribute('aria-disabled', 'false');
    expect(ui.skipButton.query()).not.toBeInTheDocument();
    expect(ui.blockTitle.query()).not.toBeInTheDocument();
  });

  it('lets the user continue to the rules step', async () => {
    setupAutoSyncConfig(server, {});
    // The rules step renders a data source picker.
    setupDataSources();

    const { user } = render(<ImportWizardGate />);

    expect(await ui.importAPIDisabledTitle.find()).toBeInTheDocument();
    await user.click(ui.nextButton.get());

    expect(await ui.rulesStep.find()).toBeInTheDocument();
  });
});
