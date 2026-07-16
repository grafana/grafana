import { render, screen, waitFor } from 'test/test-utils';

import { type DataQuery, type DataSourceApi } from '@grafana/data';
import { SortOrder } from 'app/core/utils/richHistoryTypes';
import { type RichHistoryQuery } from 'app/types/explore';

import { RecentQueriesList } from './RecentQueriesList';

// Mock RecentQueryRow so list tests focus on list-level behavior (grouping, loading, empty).
jest.mock('./RecentQueryRow', () => ({
  RecentQueryRow: jest.fn(
    ({
      query,
      queryDisplayTexts,
      datasourceLogo,
      onSelectQuery,
      onStarQuery,
      onSaveQuery,
    }: {
      query: RichHistoryQuery;
      queryDisplayTexts: string[];
      datasourceLogo?: string;
      onSelectQuery: (q: RichHistoryQuery) => void;
      onStarQuery: (id: string, starred: boolean) => void;
      onSaveQuery?: (q: RichHistoryQuery) => void;
    }) => (
      <div
        data-testid="recent-query-row"
        data-query-id={query.id}
        data-display-text={queryDisplayTexts.join('\n')}
        data-logo={datasourceLogo ?? ''}
        data-has-save={String(!!onSaveQuery)}
      >
        <button onClick={() => onSelectQuery(query)}>select {query.id}</button>
        <button onClick={() => onStarQuery(query.id, !query.starred)}>star {query.id}</button>
      </div>
    )
  ),
}));

// Mock dateTimeFormat to return deterministic heading text.
jest.mock('@grafana/data', () => {
  const original = jest.requireActual('@grafana/data');
  return {
    ...original,
    dateTimeFormat: (ts: number, opts?: { format?: string }) => {
      if (opts?.format === 'MMMM D, YYYY') {
        if (ts === 1735862400000) {
          return 'January 3, 2025';
        }
        if (ts === 1735776000000) {
          return 'January 2, 2025';
        }
      }
      return 'mocked-date';
    },
  };
});

// Mock getDataSourceInstance so datasource resolution
const mockGetDataSourceInstance = jest.fn();
jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: (uid: string) => mockGetDataSourceInstance(uid),
}));

function makeQuery(id: string, dsUid: string, dsName: string, createdAt: number): RichHistoryQuery {
  return {
    id,
    createdAt,
    datasourceUid: dsUid,
    datasourceName: dsName,
    starred: false,
    comment: '',
    queries: [{ refId: 'A', expr: `up{job="${dsName}"}` } as RichHistoryQuery['queries'][0]],
  };
}

function makeDsApi(uid: string, logoUrl: string): Partial<DataSourceApi> {
  return {
    uid,
    meta: { info: { logos: { small: logoUrl } } } as DataSourceApi['meta'],
    getQueryDisplayText: (query: DataQuery) =>
      ((query as unknown as Record<string, unknown>).expr as string) ?? 'no-expr',
  } as Partial<DataSourceApi>;
}

const jan3 = 1735862400000;
const jan2 = 1735776000000;

const queriesJan3 = [makeQuery('q1', 'ds-prom', 'Prometheus', jan3), makeQuery('q2', 'ds-prom', 'Prometheus', jan3)];

const queriesJan2 = [makeQuery('q3', 'ds-loki', 'Loki', jan2)];

const allQueries = [...queriesJan3, ...queriesJan2];

describe('RecentQueriesList', () => {
  const defaultProps = {
    queries: [] as RichHistoryQuery[],
    isLoading: false,
    sortOrder: SortOrder.Descending,
    onSelectQuery: jest.fn(),
    onStarQuery: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceInstance.mockImplementation((uid: string) => {
      if (uid === 'ds-prom') {
        return Promise.resolve(makeDsApi('ds-prom', '/img/prometheus.svg'));
      }
      if (uid === 'ds-loki') {
        return Promise.resolve(makeDsApi('ds-loki', '/img/loki.svg'));
      }
      return Promise.reject(new Error('not found'));
    });
  });

  describe('loading state', () => {
    it('shows spinner when isLoading is true', async () => {
      render(<RecentQueriesList {...defaultProps} isLoading={true} />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      // Let useAsync settle to avoid act() warnings
      await waitFor(() => expect(mockGetDataSourceInstance).not.toHaveBeenCalled());
    });

    it('does not show query rows when loading', async () => {
      render(<RecentQueriesList {...defaultProps} isLoading={true} queries={allQueries} />);
      expect(screen.queryByTestId('recent-query-row')).not.toBeInTheDocument();
      // Let useAsync settle
      await waitFor(() => expect(mockGetDataSourceInstance).toHaveBeenCalled());
    });
  });

  describe('empty state', () => {
    it('shows empty state when no queries and not loading', async () => {
      render(<RecentQueriesList {...defaultProps} queries={[]} />);
      expect(screen.getByText(/no recent queries found/i)).toBeInTheDocument();
      // Let useAsync settle (empty queries = no DS calls)
      await waitFor(() => expect(mockGetDataSourceInstance).not.toHaveBeenCalled());
    });

    it('does not show empty state when loading', async () => {
      render(<RecentQueriesList {...defaultProps} queries={[]} isLoading={true} />);
      expect(screen.queryByText(/no recent queries found/i)).not.toBeInTheDocument();
      await waitFor(() => expect(mockGetDataSourceInstance).not.toHaveBeenCalled());
    });
  });

  describe('date-grouped rows', () => {
    it('renders date headings from mapQueriesToHeadings', async () => {
      render(<RecentQueriesList {...defaultProps} queries={allQueries} />);
      expect(await screen.findByText('January 3, 2025')).toBeInTheDocument();
      expect(screen.getByText('January 2, 2025')).toBeInTheDocument();
    });

    it('renders a row for each query', async () => {
      render(<RecentQueriesList {...defaultProps} queries={allQueries} />);
      const rows = await screen.findAllByTestId('recent-query-row');
      expect(rows).toHaveLength(3);
    });

    it('passes resolved datasource logo to each row', async () => {
      render(<RecentQueriesList {...defaultProps} queries={allQueries} />);
      // Wait for DS resolution to complete and logos to appear
      await waitFor(() => {
        const rows = screen.getAllByTestId('recent-query-row');
        expect(rows[0]).toHaveAttribute('data-logo', '/img/prometheus.svg');
      });
      const rows = screen.getAllByTestId('recent-query-row');
      expect(rows[1]).toHaveAttribute('data-logo', '/img/prometheus.svg');
      expect(rows[2]).toHaveAttribute('data-logo', '/img/loki.svg');
    });

    it('passes resolved query display text to each row', async () => {
      render(<RecentQueriesList {...defaultProps} queries={allQueries} />);
      await waitFor(() => {
        const rows = screen.getAllByTestId('recent-query-row');
        expect(rows[0]).toHaveAttribute('data-display-text', 'up{job="Prometheus"}');
      });
      const rows = screen.getAllByTestId('recent-query-row');
      expect(rows[2]).toHaveAttribute('data-display-text', 'up{job="Loki"}');
    });
  });

  describe('datasource resolution failure', () => {
    it('renders rows with fallback when datasource resolution fails', async () => {
      mockGetDataSourceInstance.mockRejectedValue(new Error('not found'));
      const queries = [makeQuery('q1', 'ds-missing', 'Missing DS', jan3)];
      render(<RecentQueriesList {...defaultProps} queries={queries} />);
      // Wait for DS resolution attempt to complete
      await waitFor(() => {
        const rows = screen.getAllByTestId('recent-query-row');
        expect(rows).toHaveLength(1);
      });
      const rows = screen.getAllByTestId('recent-query-row');
      // No logo resolved, falls back to empty string
      expect(rows[0]).toHaveAttribute('data-logo', '');
      // Falls back to JSON stringified query text (from createQueryText without dsApi)
      expect(rows[0].getAttribute('data-display-text')).toBeTruthy();
    });
  });

  describe('callbacks', () => {
    it('passes onSelectQuery to rows', async () => {
      const onSelectQuery = jest.fn();
      render(<RecentQueriesList {...defaultProps} queries={[queriesJan3[0]]} onSelectQuery={onSelectQuery} />);
      const row = await screen.findByTestId('recent-query-row');
      row.querySelector('button')!.click();
      expect(onSelectQuery).toHaveBeenCalledWith(queriesJan3[0]);
    });

    it('passes onStarQuery to rows', async () => {
      const onStarQuery = jest.fn();
      render(<RecentQueriesList {...defaultProps} queries={[queriesJan3[0]]} onStarQuery={onStarQuery} />);
      const buttons = (await screen.findByTestId('recent-query-row')).querySelectorAll('button');
      buttons[1].click();
      expect(onStarQuery).toHaveBeenCalledWith('q1', true);
    });

    it('forwards onSaveQuery to rows when provided', async () => {
      const onSaveQuery = jest.fn();
      render(<RecentQueriesList {...defaultProps} queries={[queriesJan3[0]]} onSaveQuery={onSaveQuery} />);
      const row = await screen.findByTestId('recent-query-row');
      expect(row).toHaveAttribute('data-has-save', 'true');
    });

    it('does not forward onSaveQuery when not provided', async () => {
      render(<RecentQueriesList {...defaultProps} queries={[queriesJan3[0]]} />);
      const row = await screen.findByTestId('recent-query-row');
      expect(row).toHaveAttribute('data-has-save', 'false');
    });
  });
});
