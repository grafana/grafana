import { render, screen } from 'test/test-utils';

import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import AlertRulesPage from './AlertRulesPage';

describe('AlertRulesPage', () => {
  const previousPermissions = contextSrv.user.permissions;

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  it('renders the Alert rules title', () => {
    contextSrv.user.permissions = {};

    render(<AlertRulesPage />);

    expect(screen.getByText('Alert rules')).toBeInTheDocument();
  });

  it('shows New alert rule for a user with alert.rules:create', () => {
    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleCreate]: true };

    render(<AlertRulesPage />);

    expect(screen.getByRole('link', { name: 'New alert rule' })).toHaveAttribute('href', '/alerting/new/alerting');
  });

  it('hides New alert rule for a user without alert.rules:create', () => {
    contextSrv.user.permissions = {};

    render(<AlertRulesPage />);

    expect(screen.queryByRole('link', { name: 'New alert rule' })).not.toBeInTheDocument();
  });
});
