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
  stageRadio: byRole('radio', { name: /stage/i }),
};

describe('Import wizard auto-sync gate', () => {
  it('renders the wizard normally when the sync feature is off, regardless of config', async () => {
    setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });

    render(<ImportWizardGate />);

    // Flag off -> the sync query is skipped and the wizard renders.
    expect(await ui.stageRadio.find()).toBeInTheDocument();
    expect(ui.blockTitle.query()).not.toBeInTheDocument();
  });

  describe('when the sync feature is enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    beforeEach(() => {
      // Read access to the sync Config plus the permissions the wizard itself needs. Note: no admin
      // role — the block must apply to any user allowed to reach the wizard.
      grantUserPermissions([
        AccessControlAction.ActionAlertingNotificationsConfigRead,
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingProvisioningSetStatus,
      ]);
    });

    it('blocks the whole wizard and links to Settings when auto-sync is active', async () => {
      setupAutoSyncConfig(server, { specUid: MIMIR_DS_UID });

      render(<ImportWizardGate />);

      expect(await ui.blockTitle.find()).toBeInTheDocument();
      expect(ui.goToSettings.get()).toBeInTheDocument();
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

    it('renders the wizard when auto-sync is not active', async () => {
      setupAutoSyncConfig(server, {});

      render(<ImportWizardGate />);

      expect(await ui.stageRadio.find()).toBeInTheDocument();
      await waitFor(() => expect(ui.blockTitle.query()).not.toBeInTheDocument());
    });
  });
});
