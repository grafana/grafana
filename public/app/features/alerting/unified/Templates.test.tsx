import * as React from 'react';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
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
        initialEntries: ['/alerting/notifications/templates/template%20with%20spaces/duplicate?alertmanager=grafana'],
      },
    });

    expect(await screen.findByText('Edit payload')).toBeInTheDocument();
  });
});
