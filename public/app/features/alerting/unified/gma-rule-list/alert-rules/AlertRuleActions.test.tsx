import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { clearAllEnrichmentCaches } from '../rule-data/ruleResourceLookups';

import { AlertRuleActions } from './AlertRuleActions';

const server = setupMswServer();

const ALERT_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/:name';

function mockFullRule(annotations: Record<string, string>) {
  server.use(
    http.get(ALERT_RULE_GET_URL, ({ params }) =>
      HttpResponse.json({
        apiVersion: 'v0alpha1',
        kind: 'AlertRule',
        metadata: { name: params.name, annotations },
        spec: { title: 'CPU high', paused: false },
      })
    )
  );
}

describe('AlertRuleActions', () => {
  beforeEach(() => {
    clearAllEnrichmentCaches();
  });

  it('shows an Edit link to the editor when the rule is writable', async () => {
    mockFullRule({ 'grafana.com/access/canWrite': 'true' });
    render(<AlertRuleActions ruleUid="rule-1" />);

    const edit = await screen.findByRole('link', { name: 'Edit' });
    expect(edit).toHaveAttribute('href', expect.stringContaining('/alerting/rule-1/edit'));
    expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
  });

  it('hides Edit when the rule is not writable but keeps the actions menu', async () => {
    mockFullRule({ 'grafana.com/access/canWrite': 'false' });
    render(<AlertRuleActions ruleUid="rule-1" />);

    expect(await screen.findByRole('button', { name: /more/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('hides Edit for a provisioned rule', async () => {
    mockFullRule({ 'grafana.com/access/canWrite': 'true', 'grafana.com/provenance': 'api' });
    render(<AlertRuleActions ruleUid="rule-1" />);

    expect(await screen.findByRole('button', { name: /more/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
