import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { LOADING_RULE } from '../mocks/factories';

import { RecordingRuleRow } from './RecordingRuleRow';
import { type RecordingRuleSearchHit } from './recordingRuleSearchHit';

setupMswServer();

const FOLDER_PATH = ['Platform', 'Team Alerts'];

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

function precedes(a: Node, b: Node) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('RecordingRuleRow', () => {
  beforeEach(() => {
    setupDataSources(
      mockDataSource({ uid: 'prom-1', name: 'Prometheus prod' }),
      mockDataSource({ uid: 'loki-1', name: 'Loki prod' })
    );
  });

  it('labels the row by its title link to the rule view, returning to the current list', () => {
    render(<RecordingRuleRow searchHit={baseHit()} fullRule={LOADING_RULE} />, {
      historyOptions: { initialEntries: ['/alerting/rules/recording?search=cpu'] },
    });

    expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toHaveAttribute(
      'href',
      '/alerting/grafana/rule-1/view?returnTo=%2Falerting%2Frules%2Frecording%3Fsearch%3Dcpu'
    );
    expect(screen.getByRole('listitem', { name: 'cpu_usage:avg' })).toBeInTheDocument();
  });

  it.each<{ name: string; props: Partial<RecordingRuleSearchHit>; label: string }>([
    { name: 'Recording health', props: { health: 'Recording' }, label: 'Recording' },
    { name: 'Error health', props: { health: 'Error' }, label: 'Failed to evaluate rule' },
    { name: 'a missing status', props: {}, label: 'Status unavailable' },
  ])('shows the "$label" status icon for $name', ({ props, label }) => {
    render(<RecordingRuleRow searchHit={baseHit(props)} fullRule={LOADING_RULE} />);

    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('shows the last error as the description', () => {
    render(<RecordingRuleRow searchHit={baseHit({ lastError: 'query timed out' })} fullRule={LOADING_RULE} />);

    expect(screen.getByText('query timed out')).toBeInTheDocument();
  });

  describe('Records ... to ...', () => {
    it('comes after the folder path and before the queried data sources, with the target after "to"', () => {
      render(
        <RecordingRuleRow
          searchHit={baseHit({
            lastError: 'query timed out',
            metric: 'cpu_usage:avg',
            targetDataSourceUid: 'prom-1',
            dataSourceUids: ['loki-1'],
          })}
          fullRule={LOADING_RULE}
          folderPath={FOLDER_PATH}
        />
      );

      const folder = screen.getByText('Team Alerts');
      const records = screen.getByText('Records cpu_usage:avg to');
      const target = screen.getByText('Prometheus prod');
      const queried = screen.getByRole('link', { name: 'Loki prod' });
      expect(precedes(folder, records)).toBe(true);
      expect(precedes(records, target)).toBe(true);
      expect(precedes(records, queried)).toBe(true);
    });

    it.each([
      {
        name: 'only the target when the metric is unknown',
        searchHit: { targetDataSourceUid: 'prom-1' },
        text: 'Records to',
      },
      {
        name: 'only the metric when the target data source cannot be resolved',
        searchHit: { metric: 'cpu_usage:avg', targetDataSourceUid: 'gone' },
        text: 'Records cpu_usage:avg',
      },
    ])('names $name', ({ searchHit, text }) => {
      render(<RecordingRuleRow searchHit={baseHit(searchHit)} fullRule={LOADING_RULE} />);

      expect(screen.getByText(text)).toBeInTheDocument();
    });

    it('is omitted when neither metric nor a resolvable target is known', () => {
      render(<RecordingRuleRow searchHit={baseHit({ targetDataSourceUid: 'gone' })} fullRule={LOADING_RULE} />);

      expect(screen.getByRole('link', { name: 'cpu_usage:avg' })).toBeInTheDocument();
      expect(screen.queryByText(/Records/)).not.toBeInTheDocument();
    });
  });
});
