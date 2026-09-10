import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';

import TemplatesPage from './TemplatesPage';

setupMswServer();

describe('TemplatesPage', () => {
  const originalAppSubUrl = config.appSubUrl;

  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  afterEach(() => {
    config.appSubUrl = originalAppSubUrl;
  });

  it('includes the sub path in the new template link', async () => {
    config.appSubUrl = '/sub';

    render(<TemplatesPage />);

    expect(await screen.findByRole('link', { name: /new notification template/i })).toHaveAttribute(
      'href',
      '/sub/alerting/notifications/templates/new'
    );
  });
});
