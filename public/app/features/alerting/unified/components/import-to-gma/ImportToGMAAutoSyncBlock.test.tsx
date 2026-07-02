import { render, testWithFeatureToggles, waitFor } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { setupMswServer } from '../../mockApi';
import { grantUserRole } from '../../mocks';
import { setupAdminConfigGet, setupAlertmanagersStatus } from '../../mocks/server/configure/admin_config';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';

import { ImportWizardGate } from './ImportToGMA';

const server = setupMswServer();

const MIMIR_DS_UID = 'mimir-uid';
const MIMIR_DS_PAYLOAD = {
  id: 1,
  uid: MIMIR_DS_UID,
  orgId: 1,
  name: 'Test Mimir Alertmanager',
  type: 'alertmanager',
  url: 'http://localhost:9009',
  jsonData: { implementation: 'mimir' },
};

const ui = {
  blockTitle: byText(/auto-sync is enabled/i),
  goToSettings: byRole('link', { name: /go to alerting settings/i }),
  stageRadio: byRole('radio', { name: /stage/i }),
};

describe('Import wizard auto-sync gate', () => {
  it('renders the wizard normally when auto-sync is unavailable to the user (flag off)', async () => {
    render(<ImportWizardGate />);

    // No auto-sync block; the method selector is shown.
    expect(await ui.stageRadio.find()).toBeInTheDocument();
    expect(ui.blockTitle.query()).not.toBeInTheDocument();
  });

  describe('when auto-sync is available (flag on + org admin)', () => {
    testWithFeatureToggles({ enable: ['alerting.syncExternalAlertmanager'] });

    beforeEach(() => {
      grantUserRole('Admin');
      setupAlertmanagersStatus(server);
      setupDatasourcesEndpoint(server, [MIMIR_DS_PAYLOAD]);
    });

    it('blocks the whole wizard and links to Settings when auto-sync is active', async () => {
      setupAdminConfigGet(server, {
        alertmanagersChoice: AlertmanagerChoice.Internal,
        external_alertmanager_uid: MIMIR_DS_UID,
      });

      render(<ImportWizardGate />);

      expect(await ui.blockTitle.find()).toBeInTheDocument();
      expect(ui.goToSettings.get()).toBeInTheDocument();
      // The method selector is not rendered at all.
      expect(ui.stageRadio.query()).not.toBeInTheDocument();
    });

    it('renders the wizard when auto-sync is not active', async () => {
      setupAdminConfigGet(server, { alertmanagersChoice: AlertmanagerChoice.Internal });

      render(<ImportWizardGate />);

      expect(await ui.stageRadio.find()).toBeInTheDocument();
      await waitFor(() => expect(ui.blockTitle.query()).not.toBeInTheDocument());
    });
  });
});
