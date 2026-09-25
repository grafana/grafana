import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { clearAllEnrichmentCaches } from '../shared/caches';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './searchHit';

jest.mock('../../plugins/PluginOriginBadge', () => ({
  PluginOriginBadge: ({ pluginId }: { pluginId: string }) => <span>Plugin: {pluginId}</span>,
}));

const server = setupMswServer();

const RECORDING_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/recordingrules/:name';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';

function baseHit(overrides: Partial<RecordingRuleSearchHit> = {}): RecordingRuleSearchHit {
  return {
    uid: 'rule-1',
    title: 'cpu_usage:avg',
    folderUid: 'folder-1',
    labels: {},
    dataSourceUids: [],
    ...overrides,
  };
}

function mockFullRule(spec: Record<string, unknown> = {}, annotations: Record<string, string> = {}) {
  server.use(
    http.get(RECORDING_RULE_GET_URL, ({ params }) =>
      HttpResponse.json({
        apiVersion: 'v0alpha1',
        kind: 'RecordingRule',
        metadata: { name: params.name, annotations },
        spec: { title: 'cpu_usage:avg', paused: false, ...spec },
      })
    )
  );
}

// REC-3: the same rule shows the same fields in both modes; only List mode adds the folder
// path. Recording rules have no state, instances, notification routing, summary, Silence, or
// Declare-incident information - none of that ever renders here. Missing runtime health reads
// Unavailable, never a healthy default; "Recording" is the persisted success value.
describe('RecordingRuleRow', () => {
  beforeEach(() => {
    clearAllEnrichmentCaches();
    mockFullRule();
    server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ items: [{ name: 'folder-1', title: 'Team Alerts' }] })));
  });

  it('shows the title as a link', () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
  });

  it('shows Unavailable for health and the metric/target line when the search hit has neither', () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);

    // Health "Unavailable" plus "Records Unavailable to Unavailable" for metric+target.
    expect(screen.getAllByText(/Unavailable/)).toHaveLength(3);
  });

  it('never shows Recording for a rule with no persisted health', () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.queryByText('Recording')).not.toBeInTheDocument();
  });

  it('shows the persisted health when the search hit provides it', () => {
    render(<RecordingRuleRow hit={baseHit({ health: 'Recording' })} showFolderPath={false} />);
    expect(screen.getByText(/Recording/)).toBeInTheDocument();
  });

  it('shows Paused appended to health when the rule is paused', () => {
    render(<RecordingRuleRow hit={baseHit({ health: 'Recording', paused: true })} showFolderPath={false} />);
    expect(screen.getByText(/Recording · Paused/)).toBeInTheDocument();
  });

  it('shows the metric and the resolved target data source name', () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }));

    render(
      <RecordingRuleRow
        hit={baseHit({ metric: 'cpu_usage:avg', targetDataSourceUid: 'prom-1' })}
        showFolderPath={false}
      />
    );

    expect(screen.getByText('Records cpu_usage:avg to Prometheus prod')).toBeInTheDocument();
  });

  it('shows the last error', () => {
    render(<RecordingRuleRow hit={baseHit({ lastError: 'query timed out' })} showFolderPath={false} />);
    expect(screen.getByText('query timed out')).toBeInTheDocument();
  });

  it('shows the folder path only when showFolderPath is true', async () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath />);
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
  });

  it('omits the folder path in Folders mode (showFolderPath=false)', () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
  });

  it('shows the queried data source icon and name', () => {
    setupDataSources(mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }));

    render(<RecordingRuleRow hit={baseHit({ dataSourceUids: ['prom-1'] })} showFolderPath={false} />);

    expect(screen.getByAltText('Prometheus prod logo')).toBeInTheDocument();
  });

  it('shows the label count and omits __grafana_origin from it', () => {
    render(
      <RecordingRuleRow
        hit={baseHit({ labels: { team: 'infra', __grafana_origin: 'my-plugin' } })}
        showFolderPath={false}
      />
    );

    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('shows the provisioning badge once the full rule loads and reports provenance', async () => {
    mockFullRule({}, { 'grafana.com/provenance': 'api' });

    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);

    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });

  it('shows no provisioning badge while the full rule is still loading', () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows the plugin badge instead of the provisioning badge for a plugin-originated rule', async () => {
    mockFullRule({}, { 'grafana.com/provenance': 'api' });

    render(
      <RecordingRuleRow
        hit={baseHit({ labels: { __grafana_origin: 'my-plugin' } })}
        showFolderPath={false}
      />
    );

    expect(await screen.findByText('Plugin: my-plugin')).toBeInTheDocument();
    expect(screen.queryByText('Provisioned')).not.toBeInTheDocument();
  });

  it('shows no Alert-only state, routing, or summary information', () => {
    render(<RecordingRuleRow hit={baseHit({ health: 'Recording' })} showFolderPath={false} />);

    expect(screen.queryByText(/Alerting/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Normal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pending/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Default policy/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Delivered to/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Policy:/)).not.toBeInTheDocument();
  });
});
