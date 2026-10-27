import { render, screen } from 'test/test-utils';

import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

function baseHit(overrides: Partial<RecordingRuleSearchHit> = {}): RecordingRuleSearchHit {
  return { uid: 'rule-1', title: 'cpu:usage:rate5m', folderUid: 'folder-1', ...overrides };
}

function renderRow(props: Parameters<typeof RecordingRuleRow>[0]) {
  return render(
    <ul>
      <RecordingRuleRow {...props} />
    </ul>,
    { historyOptions: { initialEntries: ['/alerting/rules/recording?search=cpu'] } }
  );
}

describe('RecordingRuleRow', () => {
  it('links the title to the rule view and labels the list item with it', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toHaveAttribute(
      'href',
      '/alerting/grafana/rule-1/view?returnTo=%2Falerting%2Frules%2Frecording%3Fsearch%3Dcpu'
    );
    expect(screen.getByRole('listitem', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
  });

  it('shows the Recording status icon when health is Recording', () => {
    renderRow({ searchHit: baseHit({ health: 'Recording' }) });

    expect(screen.getByLabelText('Recording')).toBeInTheDocument();
  });

  it('reads Status unavailable, never Recording, when the search hit carries no health', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.getByLabelText('Status unavailable')).toBeInTheDocument();
  });

  it.each([
    { name: 'is known', folderPath: ['Platform', 'Team Metrics'], shown: true },
    { name: 'is still loading', folderPath: undefined, shown: false },
  ])('shows the folder path only when it $name', ({ folderPath, shown }) => {
    renderRow({ searchHit: baseHit(), folderPath });

    expect(screen.getByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByText('Team Metrics') !== null).toBe(shown);
  });

  it('shows the last error when the hit has one', () => {
    renderRow({ searchHit: baseHit({ lastError: 'remote write failed' }) });

    expect(screen.getByText('remote write failed')).toBeInTheDocument();
  });

  it('shows no description when no error is present', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText('remote write failed')).not.toBeInTheDocument();
  });

  it('shows the evaluation interval', () => {
    renderRow({ searchHit: baseHit({ interval: '1m' }) });

    expect(screen.getByRole('img', { name: 'Evaluated every 1m' })).toBeInTheDocument();
  });

  it('shows no interval indicator when interval is absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByRole('img', { name: /Evaluated every/ })).not.toBeInTheDocument();
  });

  it('shows the recorded metric and target datasource when the hit has them', () => {
    setupDataSources(mockDataSource({ uid: 'ds-mimir', name: 'Mimir' }));
    renderRow({
      searchHit: baseHit({ metric: 'memory:usage:bytes', targetDatasourceUID: 'ds-mimir' }),
    });

    expect(screen.getByText('memory:usage:bytes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mimir' })).toBeInTheDocument();
  });

  it('shows no recorded metric when metric or targetDatasourceUID is absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText(/Records/)).not.toBeInTheDocument();
  });

  it('shows queried datasources when the hit has them', () => {
    setupDataSources(mockDataSource({ uid: 'ds-prom', name: 'Prometheus' }));
    renderRow({ searchHit: baseHit({ datasourceUIDs: ['ds-prom'] }) });

    expect(screen.getByRole('link', { name: 'Prometheus' })).toBeInTheDocument();
  });

  it('shows labels when the hit has them', () => {
    renderRow({ searchHit: baseHit({ labels: { team: 'infra' } }) });

    expect(screen.getByText('1 label')).toBeInTheDocument();
  });

  it('shows no datasources when the hit has none', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText(/data source/i)).not.toBeInTheDocument();
  });

  it('shows no labels when the hit has none', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByText(/label/)).not.toBeInTheDocument();
  });

  it('renders the badge inline after the title when provided', () => {
    renderRow({ searchHit: baseHit(), badge: <span data-testid="test-badge">Badge</span> });

    expect(screen.getByTestId('test-badge')).toBeInTheDocument();
  });

  it('renders no badge when badge prop is absent', () => {
    renderRow({ searchHit: baseHit() });

    expect(screen.queryByTestId('test-badge')).not.toBeInTheDocument();
  });
});
