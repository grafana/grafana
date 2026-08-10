import { render, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { OrgRole } from '@grafana/data';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole } from '../../mocks';
import { setupAutoSyncConfig } from '../../mocks/server/handlers/k8s/config.k8s';

import { ImportWizardGate } from './ImportToGMA';

const server = setupMswServer();

const MIMIR_DS_UID = 'mimir-uid';

const ui = {
  blockTitle: byText(/auto-sync is enabled/i),
  goToSettings: byRole('link', { name: /go to alerting settings/i }),
  importRules: byRole('link', { name: /import alert rules/i }),
  disableSyncHint: byText(/disable auto-sync in Alerting settings/i),
  stageRadio: byRole('radio', { name: /stage/i }),
};

// Read access to the sync Config plus the permissions the wizard itself needs. Note: no admin role —
// the block must apply to any user allowed to reach the wizard.
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
    expect(await ui.stageRadio.find()).toBeInTheDocument();
    expect(ui.blockTitle.query()).not.toBeInTheDocument();
  });

  describe('when the sync feature is enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager', 'alertingMigrationUI'] });

    beforeEach(grantWizardPermissions);

    it('blocks the whole wizard and links admins to Settings when auto-sync is active', async () => {
      grantUserRole(OrgRole.Admin);
      setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });

      render(<ImportWizardGate />);

      expect(await ui.blockTitle.find()).toBeInTheDocument();
      expect(ui.goToSettings.get()).toBeInTheDocument();
      expect(ui.disableSyncHint.get()).toBeInTheDocument();
      // The method selector is not rendered at all.
      expect(ui.stageRadio.query()).not.toBeInTheDocument();
    });

    it('blocks non-admins with read access too (the gap this fixes)', async () => {
      grantUserRole(OrgRole.Viewer);
      setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });

      render(<ImportWizardGate />);

      expect(await ui.blockTitle.find()).toBeInTheDocument();
      expect(ui.stageRadio.query()).not.toBeInTheDocument();
    });

    it('offers rules-only import instead of the admin-only Settings link to non-admins', async () => {
      // The Settings route is gated on the Org Admin role, so linking non-admins there would bounce
      // them to the home page. Rules-only import is what they can actually do from here.
      grantUserRole(OrgRole.Editor);
      setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });

      render(<ImportWizardGate />);

      expect(await ui.blockTitle.find()).toBeInTheDocument();
      expect(ui.importRules.get()).toHaveAttribute('href', expect.stringContaining('import-datasource-managed-rules'));
      expect(ui.goToSettings.query()).not.toBeInTheDocument();
      expect(ui.disableSyncHint.query()).not.toBeInTheDocument();
    });

    it('renders the wizard when auto-sync is not active', async () => {
      setupAutoSyncConfig(server, {});

      render(<ImportWizardGate />);

      expect(await ui.stageRadio.find()).toBeInTheDocument();
      await waitFor(() => expect(ui.blockTitle.query()).not.toBeInTheDocument());
    });
  });

  describe('when the sync feature is enabled but rules import is not', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    beforeEach(grantWizardPermissions);

    // Without alertingMigrationUI the rules-only route redirects away, so the block must explain the
    // situation without offering a link that goes nowhere.
    it('blocks without offering the rules-only import link', async () => {
      grantUserRole(OrgRole.Editor);
      setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });

      render(<ImportWizardGate />);

      expect(await ui.blockTitle.find()).toBeInTheDocument();
      expect(ui.importRules.query()).not.toBeInTheDocument();
      expect(ui.goToSettings.query()).not.toBeInTheDocument();
    });
  });
});
