import React from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { setGrafanaAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/configure';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import Templates from './Templates';
import { grantUserPermissions } from './mocks';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

setupMswServer();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsWrite]);
});

describe('Templates routes', () => {
  it('allows duplication of template with spaces in name', async () => {
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/some%20template/duplicate?alertmanager=grafana'],
      },
    });

    expect(await screen.findByText('Edit payload')).toBeInTheDocument();
  });

  it('shows an error when remote AM config has been updated ', async () => {
    const originalConfig: AlertManagerCortexConfig = {
      template_files: {},
      alertmanager_config: {},
    };
    setGrafanaAlertmanagerConfig(originalConfig);

    const user = userEvent.setup();
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/new'],
      },
    });

    await user.type(await screen.findByLabelText(/template name/i), 'a');

    // Once the user has loaded the page and started creating their template,
    // update the API behaviour as if another user has also edited the config and added something in
    setGrafanaAlertmanagerConfig({ ...originalConfig, template_files: { a: 'b' } });

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/a newer alertmanager configuration is available/i)).toBeInTheDocument();
  });
});
