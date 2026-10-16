import { render, screen } from 'test/test-utils';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { AlertRuleActions } from './AlertRuleActions';

setupMswServer();

function loaded(
  annotations: Record<string, string>,
  labels: Record<string, string> = {}
): RuleResourceState<AlertRule> {
  return {
    status: 'loaded',
    rule: {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'AlertRule',
      metadata: { name: 'rule-1', annotations },
      spec: { title: 'CPU high', paused: false, labels },
    } as AlertRule,
  };
}

describe('AlertRuleActions', () => {
  it('ALERT-6: shows Edit as a plain link to the editor, with no returnTo, when the rule is writable', async () => {
    render(<AlertRuleActions ruleUid="rule-1" resourceState={loaded({ 'grafana.com/access/canWrite': 'true' })} />);

    const edit = await screen.findByRole('link', { name: 'Edit' });
    expect(edit).toHaveAttribute('href', '/alerting/rule-1/edit');
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it('ACC-7: while checking, Edit is a disabled button that stays keyboard-focusable and shows its reason', async () => {
    const { user } = render(
      <AlertRuleActions ruleUid="rule-1" resourceState={{ status: 'loading' } as RuleResourceState<AlertRule>} />
    );

    // The reason is in the accessible name, not only a tooltip.
    const edit = await screen.findByRole('button', { name: 'Edit: Checking permissions...' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    await user.tab();

    expect(edit).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Checking permissions...');
  });

  it.each([
    { name: 'failed to load', state: { status: 'error' } as RuleResourceState<AlertRule> },
    { name: 'has no capability annotation', state: loaded({}) },
    { name: 'is not writable', state: loaded({ 'grafana.com/access/canWrite': 'false' }) },
    {
      name: 'is provisioned',
      state: loaded({ 'grafana.com/access/canWrite': 'true', 'grafana.com/provenance': 'api' }),
    },
    {
      name: 'is managed by Terraform',
      state: loaded({
        'grafana.com/access/canWrite': 'true',
        'grafana.com/provenance': 'api',
        'grafana.app/managedBy': 'terraform',
      }),
    },
    {
      name: 'is managed by a plugin',
      state: loaded({ 'grafana.com/access/canWrite': 'true' }, { __grafana_origin: 'plugin/my-app' }),
    },
  ])('ACT: hides Edit when the rule $name', async ({ state }) => {
    render(<AlertRuleActions ruleUid="rule-1" resourceState={state} />);

    expect(await screen.findByRole('button', { name: /more/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });
});
