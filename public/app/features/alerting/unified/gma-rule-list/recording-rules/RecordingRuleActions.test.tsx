import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

import { RecordingRuleActions } from './RecordingRuleActions';

const server = setupMswServer();

const RECORDING_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/recordingrules/:name';

function mockRule(annotations: Record<string, string>) {
  server.use(
    http.get(RECORDING_RULE_GET_URL, ({ params }) =>
      HttpResponse.json({
        apiVersion: 'v0alpha1',
        kind: 'RecordingRule',
        metadata: { name: params.name, annotations },
        spec: { title: 'rule', paused: false },
      })
    )
  );
}

describe('RecordingRuleActions', () => {
  it('REC-5: shows Edit as a plain link to the editor, with no returnTo, next to the More menu when the user can write', async () => {
    mockRule({ 'grafana.com/access/canWrite': 'true' });
    render(<RecordingRuleActions ruleUid="rule-1" />);

    const edit = await screen.findByRole('link', { name: 'Edit' });
    expect(edit).toHaveAttribute('href', '/alerting/rule-1/edit');
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('shows a disabled Edit button that explains why when the user cannot write', async () => {
    mockRule({ 'grafana.com/access/canWrite': 'false' });
    const { user } = render(<RecordingRuleActions ruleUid="rule-1" />);

    const edit = await screen.findByRole('button', { name: 'Edit' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    await user.hover(edit);

    expect(await screen.findByText('You do not have permission to do this')).toBeInTheDocument();
  });

  it('shows Edit disabled as managed, naming the manager, for a rule managed by Terraform', async () => {
    mockRule({
      'grafana.com/access/canWrite': 'true',
      'grafana.com/provenance': 'api',
      'grafana.app/managedBy': 'terraform',
    });
    const { user } = render(<RecordingRuleActions ruleUid="rule-1" />);

    await user.hover(await screen.findByRole('button', { name: 'Edit' }));

    expect(await screen.findByText('Managed by Terraform')).toBeInTheDocument();
  });
});
