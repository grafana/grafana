import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { clearAllEnrichmentCaches } from '../rule-data/ruleResourceLookups';

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
  beforeEach(() => {
    clearAllEnrichmentCaches();
  });

  it('shows Edit linking to the editor next to the More menu when the user can write', async () => {
    mockRule({ 'grafana.com/access/canWrite': 'true' });
    render(<RecordingRuleActions ruleUid="rule-1" />);

    const edit = await screen.findByRole('link', { name: 'Edit' });
    expect(edit).toHaveAttribute('href', expect.stringContaining('/alerting/rule-1/edit'));
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('hides Edit when the user cannot write', async () => {
    mockRule({ 'grafana.com/access/canWrite': 'false' });
    render(<RecordingRuleActions ruleUid="rule-1" />);

    expect(await screen.findByRole('button', { name: 'More' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument());
  });
});
