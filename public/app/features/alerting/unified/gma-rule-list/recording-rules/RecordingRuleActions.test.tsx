import { render, screen } from 'test/test-utils';

import { type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { type RuleResourceState } from '../rule-data/ruleResourceState';

import { RecordingRuleActions } from './RecordingRuleActions';

setupMswServer();

function loaded(annotations: Record<string, string>): RuleResourceState<RecordingRule> {
  return {
    status: 'loaded',
    rule: {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'RecordingRule',
      metadata: { name: 'rule-1', annotations },
      spec: { title: 'rule', paused: false },
    } as RecordingRule,
  };
}

describe('RecordingRuleActions', () => {
  it('REC-5: shows Edit as a plain link to the editor, with no returnTo, next to the More menu when the user can write', async () => {
    render(<RecordingRuleActions ruleUid="rule-1" resourceState={loaded({ 'grafana.com/access/canWrite': 'true' })} />);

    const edit = await screen.findByRole('link', { name: 'Edit' });
    expect(edit).toHaveAttribute('href', '/alerting/rule-1/edit');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it.each<{ name: string; annotations: Record<string, string> }>([
    { name: 'the user cannot write', annotations: { 'grafana.com/access/canWrite': 'false' } },
    {
      name: 'the rule is managed by Terraform',
      annotations: {
        'grafana.com/access/canWrite': 'true',
        'grafana.com/provenance': 'api',
        'grafana.app/managedBy': 'terraform',
      },
    },
  ])('hides Edit when $name', async ({ annotations }) => {
    render(<RecordingRuleActions ruleUid="rule-1" resourceState={loaded(annotations)} />);

    expect(await screen.findByRole('button', { name: /more/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it('ACC-7: while checking, Edit is a disabled button that stays keyboard-focusable and shows its reason', async () => {
    const { user } = render(
      <RecordingRuleActions
        ruleUid="rule-1"
        resourceState={{ status: 'loading' } as RuleResourceState<RecordingRule>}
      />
    );

    // The reason is part of the disabled button's accessible name, not only a hover tooltip.
    const edit = await screen.findByRole('button', { name: 'Edit: Checking permissions...' });
    await user.tab();

    expect(edit).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Checking permissions...');
  });
});
