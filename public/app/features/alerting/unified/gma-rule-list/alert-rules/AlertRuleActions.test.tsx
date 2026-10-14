import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';

import { AlertRuleActions } from './AlertRuleActions';

const server = setupMswServer();

const ALERT_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/:name';

function mockFullRule(annotations: Record<string, string>, labels: Record<string, string> = {}) {
  server.use(
    http.get(ALERT_RULE_GET_URL, ({ params }) =>
      HttpResponse.json({
        apiVersion: 'v0alpha1',
        kind: 'AlertRule',
        metadata: { name: params.name, annotations },
        spec: { title: 'CPU high', paused: false, labels },
      })
    )
  );
}

describe('AlertRuleActions', () => {
  it('ALERT-6: shows Edit as a plain link to the editor, with no returnTo, when the rule is writable', async () => {
    mockFullRule({ 'grafana.com/access/canWrite': 'true' });
    render(<AlertRuleActions ruleUid="rule-1" />);

    const edit = await screen.findByRole('link', { name: 'Edit' });
    expect(edit).toHaveAttribute('href', '/alerting/rule-1/edit');
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it.each([
    {
      name: 'is still loading',
      reason: 'Checking permissions...',
      setup: () => server.use(http.get(ALERT_RULE_GET_URL, () => new Promise(() => {}))),
    },
    {
      name: 'failed to load',
      reason: 'Permission unknown',
      setup: () => server.use(http.get(ALERT_RULE_GET_URL, () => HttpResponse.json({}, { status: 500 }))),
    },
    {
      name: 'has no capability annotation',
      reason: 'Permission unknown',
      setup: () => mockFullRule({}),
    },
    {
      name: 'is not writable',
      reason: 'You do not have permission to do this',
      setup: () => mockFullRule({ 'grafana.com/access/canWrite': 'false' }),
    },
    {
      name: 'is provisioned',
      reason: 'This rule is provisioned and cannot be edited through the UI',
      setup: () => mockFullRule({ 'grafana.com/access/canWrite': 'true', 'grafana.com/provenance': 'api' }),
    },
    {
      name: 'is managed by Terraform',
      reason: 'Managed by Terraform',
      setup: () =>
        mockFullRule({
          'grafana.com/access/canWrite': 'true',
          'grafana.com/provenance': 'api',
          'grafana.app/managedBy': 'terraform',
        }),
    },
    {
      name: 'is managed by a plugin',
      reason: 'This rule is managed by a plugin and cannot be edited through the UI',
      setup: () => mockFullRule({ 'grafana.com/access/canWrite': 'true' }, { __grafana_origin: 'plugin/my-app' }),
    },
  ])('ACT: shows a disabled Edit button that explains why when the rule $name', async ({ reason, setup }) => {
    setup();
    const { user } = render(<AlertRuleActions ruleUid="rule-1" />);

    const edit = await screen.findByRole('button', { name: 'Edit' });
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    await user.hover(edit);

    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });
});
