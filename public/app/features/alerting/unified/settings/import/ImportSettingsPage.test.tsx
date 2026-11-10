import { HttpResponse, http } from 'msw';
import { act, render, screen, within } from 'test/test-utils';
import { byRole, byText } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, grantUserRole } from '../../mocks';
import { setupDatasourcesEndpoint } from '../../mocks/server/configure/datasources';
import { setupDataSources } from '../../testSetup/datasources';

import ImportSettingsPage from './ImportSettingsPage';
import { type StagedExtraConfig } from './stagedConfig';

const server = setupMswServer();

const AM_CONFIG_URL = '/api/alertmanager/:name/config/api/v1/alerts';

const stagedConfig: StagedExtraConfig = {
  identifier: 'prometheus-prod',
  alertmanager_config: 'route:\n  receiver: default\nreceivers:\n  - name: default\n',
  template_files: {},
  managed_by: 'manual',
};

const ui = {
  notificationsStep: byRole('group', { name: /import notification configuration/i }),
  rulesStep: byRole('group', { name: /import rules/i }),
  stagedNotice: byText(/a configuration is already staged/i),
};

function serveStagedConfig(staged?: StagedExtraConfig) {
  server.use(
    http.get(AM_CONFIG_URL, () =>
      HttpResponse.json<AlertManagerCortexConfig>({
        alertmanager_config: {},
        template_files: {},
        extra_config: staged ? [staged] : undefined,
      })
    )
  );
}

beforeEach(() => {
  grantUserRole('ServerAdmin');
  grantUserPermissions([
    AccessControlAction.AlertingNotificationsRead,
    AccessControlAction.AlertingNotificationsWrite,
    AccessControlAction.AlertingRuleCreate,
    AccessControlAction.AlertingProvisioningSetStatus,
  ]);
  setupDatasourcesEndpoint(server, []);
  setupDataSources();
  setTestFlags({ [FlagKeys.AlertingImportAlertmanagerAPI]: true });
});

// The reset fires OpenFeature events while components are still mounted, so it needs act.
afterEach(async () => {
  await act(async () => {
    setTestFlags();
  });
});

describe('Import settings tab', () => {
  it('shows the import wizard, starting on the notifications step', async () => {
    serveStagedConfig(undefined);

    render(<ImportSettingsPage />);

    expect(await ui.notificationsStep.find()).toBeInTheDocument();
    expect(ui.stagedNotice.query()).not.toBeInTheDocument();
  });

  it('shows only the staged copy in the notifications step while one is staged', async () => {
    serveStagedConfig(stagedConfig);

    render(<ImportSettingsPage />);

    const step = await ui.notificationsStep.find();
    expect(await within(step).findByRole('heading', { name: 'prometheus-prod' })).toBeInTheDocument();
    expect(ui.stagedNotice.get()).toBeInTheDocument();
    // The import form stays hidden until the staged copy is promoted or reverted.
    expect(screen.queryByText(/import source/i)).not.toBeInTheDocument();
  });

  it('starts the wizard over when the page is navigated to again', async () => {
    serveStagedConfig(undefined);

    render(<ImportSettingsPage />, { historyOptions: { initialEntries: ['/alerting/admin/import?step=rules'] } });

    expect(await ui.rulesStep.find()).toBeInTheDocument();

    // What finishing an import does before it lands back here.
    act(() => locationService.push('/alerting/admin/import'));

    expect(await ui.notificationsStep.find()).toBeInTheDocument();
  });
});
