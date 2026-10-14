import { render, screen } from 'test/test-utils';

import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertRulesHeaderActions } from './AlertRulesHeaderActions';

describe('AlertRulesHeaderActions', () => {
  it('ALERT-5: shows New alert rule and Design rule for provisioning for a user who can create rules', async () => {
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

  it('ALERT-5: hides New alert rule for a user without create permission, but keeps the ungated Design rule action', async () => {
    grantUserPermissions([]);
    const { user } = render(<AlertRulesHeaderActions />);

    expect(screen.queryByRole('link', { name: /new alert rule/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByRole('menuitem', { name: /design rule for provisioning/i })).toBeInTheDocument();
  });

  it('never offers Recording-rule or export-all/import actions', async () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    const { user } = render(<AlertRulesHeaderActions />);

    expect(screen.queryByRole('link', { name: /new recording rule/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.queryByRole('menuitem', { name: /export all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /import/i })).not.toBeInTheDocument();
  });

  it('places New alert rule before the More menu button', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleCreate]);
    render(<AlertRulesHeaderActions />);

    const newRule = screen.getByRole('link', { name: /new alert rule/i });
    const more = screen.getByRole('button', { name: /more/i });
    expect(newRule.compareDocumentPosition(more)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
