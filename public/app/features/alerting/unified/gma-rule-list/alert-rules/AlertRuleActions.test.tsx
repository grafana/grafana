import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { FAILED_RULE, LOADING_RULE, buildAlertRule, loadedRule } from '../mocks/factories';

import { AlertRuleActions } from './AlertRuleActions';

setupMswServer();

const WRITABLE = { 'grafana.com/access/canWrite': 'true' };

function loaded(annotations: Record<string, string>) {
  return loadedRule(buildAlertRule({ annotations }));
}

describe('AlertRuleActions', () => {
  it('shows Edit as a plain link to the editor, with no returnTo, when the rule is writable', async () => {
    render(<AlertRuleActions ruleUid="rule-1" resourceState={loaded(WRITABLE)} />);

    const edit = await screen.findByRole('link', { name: 'Edit' });
    expect(edit).toHaveAttribute('href', '/alerting/rule-1/edit');
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it('while checking, Edit is a disabled button that stays keyboard-focusable and shows its reason', async () => {
    const { user } = render(<AlertRuleActions ruleUid="rule-1" resourceState={LOADING_RULE} />);

    // The reason is in the accessible name, not only a tooltip.
    const edit = await screen.findByRole('button', { name: 'Edit: Checking permissions...' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    await user.tab();

    expect(edit).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Checking permissions...');
  });

  it.each([
    { name: 'failed to load', state: FAILED_RULE },
    { name: 'is provisioned', state: loaded({ ...WRITABLE, 'grafana.com/provenance': 'api' }) },
  ])('hides Edit when the rule $name', async ({ state }) => {
    render(<AlertRuleActions ruleUid="rule-1" resourceState={state} />);

    expect(await screen.findByRole('button', { name: /more/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });
});
