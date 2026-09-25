import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { clearAllEnrichmentCaches } from '../shared/caches';

import { AlertRuleRow } from './AlertRuleRow';
import { type AlertRuleSearchHit } from './searchHit';

const server = setupMswServer();

const ALERT_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/:name';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';

function baseHit(overrides: Partial<AlertRuleSearchHit> = {}): AlertRuleSearchHit {
  return {
    uid: 'rule-1',
    title: 'CPU high',
    folderUid: 'folder-1',
    labels: {},
    dataSourceUids: [],
    ...overrides,
  };
}

function mockFullRule(spec: Record<string, unknown> = {}) {
  server.use(
    http.get(ALERT_RULE_GET_URL, ({ params }) =>
      HttpResponse.json({
        apiVersion: 'v0alpha1',
        kind: 'AlertRule',
        metadata: { name: params.name, annotations: {} },
        spec: { title: 'CPU high', paused: false, ...spec },
      })
    )
  );
}

// ALERT-4: the same rule shows the same fields in both modes; only List mode adds the folder
// path. Missing runtime state/health reads Unavailable, never a healthy default.
describe('AlertRuleRow', () => {
  beforeEach(() => {
    clearAllEnrichmentCaches();
    mockFullRule();
    server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ items: [{ name: 'folder-1', title: 'Team Alerts' }] })));
  });

  it('shows Unavailable for state and health when the search hit has neither', async () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

    // Two "Unavailable"s: state and health, joined by " · ".
    expect(await screen.findAllByText(/Unavailable/)).toHaveLength(2);
  });

  it('never shows Healthy for a rule with no persisted health', () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

    expect(screen.queryByText(/Healthy/)).not.toBeInTheDocument();
  });

  it('shows the persisted state and health when the search hit provides them', async () => {
    render(<AlertRuleRow hit={baseHit({ state: 'Alerting', health: 'Error' })} showFolderPath={false} />);

    expect(await screen.findByText(/Alerting/)).toBeInTheDocument();
    expect(screen.getByText(/Error/)).toBeInTheDocument();
  });

  it('shows the folder path only when showFolderPath is true', async () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath />);
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
  });

  it('omits the folder path in Folders mode (showFolderPath=false)', () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
  });

  it('shows the last error in place of the summary annotation when both are present', () => {
    render(<AlertRuleRow hit={baseHit({ lastError: 'connection refused', summary: 'CPU too high' })} showFolderPath={false} />);

    expect(screen.getByText('connection refused')).toBeInTheDocument();
    expect(screen.queryByText('CPU too high')).not.toBeInTheDocument();
  });

  it('shows Default policy when no notification type is set', () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.getByText('Default policy')).toBeInTheDocument();
  });

  it('shows the direct receiver for SimplifiedRouting', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ notificationType: 'SimplifiedRouting', receiver: 'on-call-team' })}
        showFolderPath={false}
      />
    );
    expect(screen.getByText('Delivered to on-call-team')).toBeInTheDocument();
  });

  it('shows the named policy for NamedRoutingTree', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ notificationType: 'NamedRoutingTree', routingTree: 'escalation-policy' })}
        showFolderPath={false}
      />
    );
    expect(screen.getByText('Policy: escalation-policy')).toBeInTheDocument();
  });

  it('shows the queried data source icon and name', () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }));

    render(<AlertRuleRow hit={baseHit({ dataSourceUids: ['prom-1'] })} showFolderPath={false} />);

    expect(screen.getByAltText('Prometheus prod logo')).toBeInTheDocument();
  });

  it('shows the label count and omits __grafana_origin from it', () => {
    render(
      <AlertRuleRow
        hit={baseHit({ labels: { team: 'infra', __grafana_origin: 'my-plugin' } })}
        showFolderPath={false}
      />
    );

    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('shows the provisioning badge once the full rule loads and reports provenance', async () => {
    mockFullRule();
    server.use(
      http.get(ALERT_RULE_GET_URL, ({ params }) =>
        HttpResponse.json({
          apiVersion: 'v0alpha1',
          kind: 'AlertRule',
          metadata: { name: params.name, annotations: { 'grafana.com/provenance': 'api' } },
          spec: { title: 'CPU high', paused: false },
        })
      )
    );

    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });

  it('shows no provisioning badge while the full rule is still loading', () => {
    render(<AlertRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });
});
