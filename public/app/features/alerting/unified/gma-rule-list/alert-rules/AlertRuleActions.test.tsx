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

  it('ACC-7: a disabled Edit button stays keyboard-focusable and shows its reason on focus', async () => {
    const { user } = render(
      <AlertRuleActions ruleUid="rule-1" resourceState={loaded({ 'grafana.com/access/canWrite': 'false' })} />
    );

    const edit = await screen.findByRole('button', { name: 'Edit: You do not have permission to do this' });
    await user.tab();

    expect(edit).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('You do not have permission to do this');
  });

  it.each([
    {
      name: 'is still loading',
      reason: 'Checking permissions...',
      state: { status: 'loading' } as RuleResourceState<AlertRule>,
    },
    {
      name: 'failed to load',
      reason: 'Permission unknown',
      state: { status: 'error' } as RuleResourceState<AlertRule>,
    },
    {
      name: 'has no capability annotation',
      reason: 'Permission unknown',
      state: loaded({}),
    },
    {
      name: 'is not writable',
      reason: 'You do not have permission to do this',
      state: loaded({ 'grafana.com/access/canWrite': 'false' }),
    },
    {
      name: 'is provisioned',
      reason: 'Provisioned',
      state: loaded({ 'grafana.com/access/canWrite': 'true', 'grafana.com/provenance': 'api' }),
    },
    {
      name: 'is managed by Terraform',
      reason: 'Managed by Terraform',
      state: loaded({
        'grafana.com/access/canWrite': 'true',
        'grafana.com/provenance': 'api',
        'grafana.app/managedBy': 'terraform',
      }),
    },
    {
      name: 'is managed by a plugin',
      reason: 'This rule is managed by a plugin and cannot be edited through the UI',
      state: loaded({ 'grafana.com/access/canWrite': 'true' }, { __grafana_origin: 'plugin/my-app' }),
    },
  ])('ACT: shows a disabled Edit button that explains why when the rule $name', async ({ reason, state }) => {
    const { user } = render(<AlertRuleActions ruleUid="rule-1" resourceState={state} />);

    // ACC-7: reason is in the accessible name, not only a tooltip.
    const edit = await screen.findByRole('button', { name: `Edit: ${reason}` });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    await user.hover(edit);

    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });
});
