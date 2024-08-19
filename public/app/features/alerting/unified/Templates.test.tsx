import * as React from 'react';
import { render, screen, within } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AccessControlAction } from 'app/types';

import Templates from './Templates';
import { grantUserPermissions } from './mocks';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

setupMswServer();

const ui = {
  templateForm: byRole('form', { name: 'Template form' }),
};

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

  it('allows editing of template with spaces in name', async () => {
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/template%20with%20spaces/edit?alertmanager=grafana'],
      },
    });

    expect(await screen.findByText('Edit payload')).toBeInTheDocument();
  });

  it('renders empty template form', async () => {
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/new'],
      },
    });

    const form = await ui.templateForm.find();

    expect(form).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: /Template name/ })).toHaveValue('');
  });
});
