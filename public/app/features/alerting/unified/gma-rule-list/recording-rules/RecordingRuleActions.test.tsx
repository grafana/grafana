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

  it('shows a disabled Edit button that explains why when the user cannot write', async () => {
    const { user } = render(
      <RecordingRuleActions ruleUid="rule-1" resourceState={loaded({ 'grafana.com/access/canWrite': 'false' })} />
    );

    // ACC-7: the reason is part of the disabled button's accessible name, not only a hover tooltip.
    const edit = await screen.findByRole('button', { name: 'Edit: You do not have permission to do this' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    await user.hover(edit);

    expect(await screen.findByText('You do not have permission to do this')).toBeInTheDocument();
  });

  it('ACC-7: a disabled Edit button stays keyboard-focusable and shows its reason on focus', async () => {
    const { user } = render(
      <RecordingRuleActions ruleUid="rule-1" resourceState={loaded({ 'grafana.com/access/canWrite': 'false' })} />
    );

    const edit = await screen.findByRole('button', { name: 'Edit: You do not have permission to do this' });
    await user.tab();

    expect(edit).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('You do not have permission to do this');
  });

  it('shows Edit disabled as managed, naming the manager, for a rule managed by Terraform', async () => {
    const { user } = render(
      <RecordingRuleActions
        ruleUid="rule-1"
        resourceState={loaded({
          'grafana.com/access/canWrite': 'true',
          'grafana.com/provenance': 'api',
          'grafana.app/managedBy': 'terraform',
        })}
      />
    );

    await user.hover(await screen.findByRole('button', { name: 'Edit: Managed by Terraform' }));

    expect(await screen.findByText('Managed by Terraform')).toBeInTheDocument();
  });
});
