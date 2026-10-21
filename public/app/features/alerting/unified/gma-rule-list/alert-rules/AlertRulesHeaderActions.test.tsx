import { render, screen } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertRulesHeaderActions } from './AlertRulesHeaderActions';

describe('AlertRulesHeaderActions', () => {
  it('shows New alert rule and Design rule for provisioning for a user who can create rules', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    const { user } = render(<AlertRulesHeaderActions />);

    expect(screen.getByRole('link', { name: /new alert rule/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/alerting/new/alerting')
    );

    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByRole('menuitem', { name: /design rule for provisioning/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/alerting/export-new-rule')
    );
  });

  it('hides New alert rule for a user without create permission, but keeps the ungated Design rule action', async () => {
    grantUserPermissions([]);
    const { user } = render(<AlertRulesHeaderActions />);

    expect(screen.queryByRole('link', { name: /new alert rule/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByRole('menuitem', { name: /design rule for provisioning/i })).toBeInTheDocument();
  });

  it('links to New alert rule and Design rule for provisioning without returnTo, from a filtered list', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    locationService.push('/alerting/rules/alert?search=state%3Afiring');
    const { user } = render(<AlertRulesHeaderActions />);

    expect(screen.getByRole('link', { name: /new alert rule/i })).toHaveAttribute('href', '/alerting/new/alerting');

    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByRole('menuitem', { name: /design rule for provisioning/i })).toHaveAttribute(
      'href',
      '/alerting/export-new-rule'
    );
  });

  it('never offers Recording-rule or export-all/import actions', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    const { user } = render(<AlertRulesHeaderActions />);

    expect(screen.queryByRole('link', { name: /new recording rule/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.queryByRole('menuitem', { name: /export all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /import/i })).not.toBeInTheDocument();
  });
});
