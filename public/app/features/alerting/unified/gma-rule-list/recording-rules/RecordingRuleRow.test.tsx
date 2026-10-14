import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { clearAllEnrichmentCaches } from '../rule-data/ruleResourceLookups';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

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

// The same rule shows the same fields in both modes; only List mode adds the folder path.
// Recording rules have no state, instances, routing, or summary, so none of that renders.
describe('RecordingRuleRow', () => {
  beforeEach(() => {
    clearAllEnrichmentCaches();
    mockFullRule();
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'root', title: 'Platform' },
            { name: 'folder-1', title: 'Team Alerts' },
          ],
        })
      )
    );
    setupDataSources(
      mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }),
      mockDataSource({ uid: 'loki-1', name: 'Loki prod' })
    );
  });

  it('labels the row by its title link', () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);
    const link = screen.getByRole('link', { name: 'cpu_usage:avg' });
    expect(link).toHaveAttribute('href', '/alerting/grafana/rule-1/view');
    expect(screen.getByRole('listitem', { name: 'cpu_usage:avg' })).toBeInTheDocument();
  });

  it.each([
    { name: 'Recording health', props: { health: 'Recording' }, label: 'Recording' },
    { name: 'Error health', props: { health: 'Error' }, label: 'Failed to evaluate rule' },
    { name: 'paused', props: { health: 'Recording', paused: true }, label: 'Paused' },
    { name: 'missing status', props: {}, label: 'Status unavailable' },
  ])('shows the "$label" status icon for $name', ({ props, label }) => {
    render(<RecordingRuleRow hit={baseHit(props)} showFolderPath={false} />);
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('never prints health, paused or interval placeholders as text', () => {
    render(<RecordingRuleRow hit={baseHit({ health: 'Recording', paused: true })} showFolderPath={false} />);
    expect(screen.getByLabelText('Paused')).toBeInTheDocument();
    expect(screen.queryByText(/Unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Interval/)).not.toBeInTheDocument();
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
  });

  it('shows "Records metric to target" as the description when there is no error', () => {
    render(
      <RecordingRuleRow
        hit={baseHit({ metric: 'cpu_usage:avg', targetDataSourceUid: 'prom-1', dataSourceUids: ['loki-1'] })}
        showFolderPath={false}
      />
    );

    expect(screen.getByText('Records cpu_usage:avg to Prometheus prod')).toBeInTheDocument();
    // The queried data source is metadata, listed after the description, not the target.
    expect(screen.getByRole('link', { name: 'Loki prod' })).toBeInTheDocument();
  });

  it('shows the error as the description and moves "Records … to …" into the metadata line', () => {
    render(
      <RecordingRuleRow
        hit={baseHit({
          lastError: 'query timed out',
          metric: 'cpu_usage:avg',
          targetDataSourceUid: 'prom-1',
          labels: { team: 'infra' },
        })}
        showFolderPath={false}
      />
    );

    expect(screen.getByText('query timed out')).toBeInTheDocument();
    const records = screen.getByText('Records cpu_usage:avg to Prometheus prod');
    const error = screen.getByText('query timed out');
    // Error comes first in document order, the records item follows in the metadata.
    expect(error.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('|')).toBeInTheDocument();
  });

  it('omits the Records line when neither metric nor target is known', () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.queryByText(/Records/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
  });

  it('shows the folder path with chevron separators in List mode', async () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath />);
    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Team Alerts')).toBeInTheDocument();
  });

  it('omits the folder path in Folders mode', () => {
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
  });

  it('orders metadata as folder path, data sources, labels', async () => {
    render(
      <RecordingRuleRow
        hit={baseHit({ dataSourceUids: ['loki-1'], labels: { team: 'infra', env: 'prod' } })}
        showFolderPath
      />
    );

    const folder = await screen.findByText('Team Alerts');
    const dataSource = screen.getByRole('link', { name: 'Loki prod' });
    const labels = screen.getByText('2 labels');
    expect(folder.compareDocumentPosition(dataSource) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dataSource.compareDocumentPosition(labels) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not count __grafana_origin as a label', () => {
    render(
      <RecordingRuleRow
        hit={baseHit({ labels: { team: 'infra', __grafana_origin: 'my-plugin' } })}
        showFolderPath={false}
      />
    );
    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('shows the provisioning badge once the full rule reports provenance', async () => {
    mockFullRule({}, { 'grafana.com/provenance': 'api' });
    render(<RecordingRuleRow hit={baseHit()} showFolderPath={false} />);
    expect(await screen.findByText('Provisioned')).toBeInTheDocument();
  });

  it('shows no provisioning badge for a rule without provenance', async () => {
    render(<RecordingRuleRow hit={baseHit({ metric: 'm' })} showFolderPath={false} />);
    expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Provisioned')).not.toBeInTheDocument());
  });

  it('shows no Alert-only information', () => {
    render(<RecordingRuleRow hit={baseHit({ health: 'Recording' })} showFolderPath={false} />);
    expect(screen.getByLabelText('Recording')).toBeInTheDocument();
    expect(screen.queryByText(/Default policy|Delivered to|Policy:/)).not.toBeInTheDocument();
  });
});
