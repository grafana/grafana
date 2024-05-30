import React from 'react';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AccessControlAction } from 'app/types';

import Templates from './Templates';
import setupGrafanaManagedServer from './components/contact-points/__mocks__/grafanaManagedServer';
import { grantUserPermissions } from './mocks';

const server = setupMswServer();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsWrite]);
  setupGrafanaManagedServer(server);
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
});
