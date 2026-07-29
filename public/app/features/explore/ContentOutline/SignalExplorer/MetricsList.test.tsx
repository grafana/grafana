import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type TimeRange } from '@grafana/data';

import { type MetricRow, useMetricCatalog } from '../../signalExplorer';

import { MetricsList } from './MetricsList';

// The catalog hook is mocked; `useVisibleBatch` and `INITIAL_BATCH` are deliberately left real, so
// the batching assertions below exercise the actual cap rather than a stand-in for it.
jest.mock('../../signalExplorer', () => ({
  ...jest.requireActual('../../signalExplorer'),
  useMetricCatalog: jest.fn(),
}));

const useMetricCatalogMock = jest.mocked(useMetricCatalog);

const timeRange = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

const row = (name: string): MetricRow => ({ name, type: 'counter' });

const setCatalog = (metrics: MetricRow[], rest: { loading?: boolean; error?: Error } = {}) => {
  useMetricCatalogMock.mockReturnValue({ metrics, loading: false, ...rest });
};

const renderList = () => render(<MetricsList dsUid="prom-uid" dsType="prometheus" timeRange={timeRange} />);

const rowCount = () => screen.getAllByRole('listitem').length;

describe('<MetricsList />', () => {
  beforeEach(() => {
    useMetricCatalogMock.mockReset();
  });

  it('renders the search input', () => {
    setCatalog([]);
    renderList();

    expect(screen.getByPlaceholderText('Search metrics')).toBeInTheDocument();
  });

  it('renders the metric names the catalog resolved for this datasource', () => {
    setCatalog([row('up'), row('node_cpu_seconds_total')]);
    renderList();

    expect(screen.getByText('up')).toBeInTheDocument();
    expect(screen.getByText('node_cpu_seconds_total')).toBeInTheDocument();
    expect(useMetricCatalogMock).toHaveBeenCalledWith(
      { uid: 'prom-uid', type: 'prometheus' },
      timeRange,
      expect.objectContaining({ searchText: '' })
    );
  });

  // Filtering belongs to the hook, not to this component: the catalog it searches is the whole
  // datasource's, which this component never holds.
  it('hands the search term to the catalog instead of filtering a list it already rendered', async () => {
    setCatalog([row('up')]);
    renderList();

    await userEvent.type(screen.getByPlaceholderText('Search metrics'), 'node_cpu');

    expect(useMetricCatalogMock).toHaveBeenLastCalledWith(
      { uid: 'prom-uid', type: 'prometheus' },
      timeRange,
      expect.objectContaining({ searchText: 'node_cpu' })
    );
  });

  it('reports that the catalog is loading', () => {
    setCatalog([], { loading: true });
    renderList();

    expect(screen.getByText('Loading metrics…')).toBeInTheDocument();
  });

  it('reports a catalog that failed to load', () => {
    setCatalog([], { error: new Error('boom') });
    renderList();

    expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
  });

  it('says so when the datasource has no metrics matching the search', async () => {
    setCatalog([]);
    renderList();

    await userEvent.type(screen.getByPlaceholderText('Search metrics'), 'no_such_metric');

    expect(screen.getByText('No metrics found')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  // A real Prometheus catalog runs to tens of thousands of names. Every one of them in the DOM is
  // the defect this list exists to not have.
  describe('batching', () => {
    const manyMetrics = Array.from({ length: 100 }, (_, i) => row(`metric_${i}`));

    it('renders only the first batch of a large catalog', () => {
      setCatalog(manyMetrics);
      renderList();

      expect(rowCount()).toBe(25);
      expect(screen.getByText('metric_0')).toBeInTheDocument();
      expect(screen.queryByText('metric_99')).not.toBeInTheDocument();
    });

    it('adds exactly one increment per "show more"', async () => {
      setCatalog(manyMetrics);
      renderList();

      await userEvent.click(screen.getByRole('button', { name: /show more/i }));

      expect(rowCount()).toBe(50);
    });

    it('drops back to the first batch when the search changes', async () => {
      setCatalog(manyMetrics);
      renderList();
      await userEvent.click(screen.getByRole('button', { name: /show more/i }));
      expect(rowCount()).toBe(50);

      await userEvent.type(screen.getByPlaceholderText('Search metrics'), 'metric');

      expect(rowCount()).toBe(25);
    });

    it('offers no "show more" once the whole catalog is on screen', () => {
      setCatalog([row('up')]);
      renderList();

      expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
    });
  });
});
