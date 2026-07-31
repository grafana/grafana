import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type TimeRange } from '@grafana/data';

import { MetricsList } from './MetricsList';

import { type MetricRow, useLabelValues, useMetricCatalog, useMetricDetail } from './index';

// The data hooks are mocked; `useVisibleBatch` and `INITIAL_BATCH` are deliberately left real, so the
// batching assertions below exercise the actual cap rather than a stand-in for it.
jest.mock('./index', () => ({
  ...jest.requireActual('./index'),
  useMetricCatalog: jest.fn(),
  useMetricDetail: jest.fn(),
  useLabelValues: jest.fn(),
}));

const useMetricCatalogMock = jest.mocked(useMetricCatalog);
const useMetricDetailMock = jest.mocked(useMetricDetail);
const useLabelValuesMock = jest.mocked(useLabelValues);

const timeRange = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

const row = (name: string): MetricRow => ({ name, type: 'counter' });

const setCatalog = (metrics: MetricRow[], rest: { loading?: boolean; error?: Error } = {}) => {
  useMetricCatalogMock.mockReturnValue({ metrics, loading: false, ...rest });
};

const renderList = () => render(<MetricsList dsUid="prom-uid" dsType="prometheus" timeRange={timeRange} />);

const rowCount = () => screen.getAllByRole('listitem').length;

const setLabelKeys = (labelKeys: string[], rest: { loading?: boolean; error?: Error } = {}) => {
  useMetricDetailMock.mockReturnValue({ labelKeys, loading: false, ...rest });
};

const setLabelValues = (values: string[], rest: { loading?: boolean; error?: Error } = {}) => {
  useLabelValuesMock.mockReturnValue({ values, loading: false, ...rest });
};

const expandMetric = (name: string) => userEvent.click(screen.getByRole('button', { name: `Expand ${name}` }));

describe('<MetricsList />', () => {
  beforeEach(() => {
    useMetricCatalogMock.mockReset();
    useMetricDetailMock.mockReset().mockReturnValue({ labelKeys: [], loading: false });
    useLabelValuesMock.mockReset().mockReturnValue({ values: [], loading: false });
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

  describe('expanding a metric row', () => {
    it('fires no label request while every row is collapsed', () => {
      setCatalog([row('up'), row('node_cpu_seconds_total')]);
      renderList();

      // Laziness is structural: the block that calls the hook is not mounted, so a collapsed row
      // cannot fetch even by accident.
      expect(useMetricDetailMock).not.toHaveBeenCalled();
    });

    // Pointing at an id that is not in the document is worse for a screen reader than saying nothing.
    it('names no block while collapsed, because there is no block', () => {
      setCatalog([row('up')]);
      renderList();

      expect(screen.getByRole('button', { name: 'Expand up' })).not.toHaveAttribute('aria-controls');
    });

    it('reveals the metric’s label keys', async () => {
      setCatalog([row('up')]);
      setLabelKeys(['instance', 'job']);
      renderList();

      await expandMetric('up');

      expect(screen.getByText('instance')).toBeInTheDocument();
      expect(screen.getByText('job')).toBeInTheDocument();
      expect(useMetricDetailMock).toHaveBeenCalledWith({ uid: 'prom-uid', type: 'prometheus' }, timeRange, 'up', true);
    });

    it('collapses again, unmounting the labels', async () => {
      setCatalog([row('up')]);
      setLabelKeys(['job']);
      renderList();
      await expandMetric('up');

      await userEvent.click(screen.getByRole('button', { name: 'Collapse up' }));

      expect(screen.queryByText('job')).not.toBeInTheDocument();
    });

    // One metric at a time: every open row holds a label request, and the list is unbounded.
    it('collapses the previously expanded metric', async () => {
      setCatalog([row('up'), row('node_load1')]);
      setLabelKeys(['job']);
      renderList();
      await expandMetric('up');

      await expandMetric('node_load1');

      expect(screen.getByRole('button', { name: 'Expand up' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Collapse node_load1' })).toBeInTheDocument();
    });

    it('reports labels that are loading, and labels that failed', async () => {
      setCatalog([row('up')]);
      setLabelKeys([], { loading: true });
      renderList();
      await expandMetric('up');
      expect(screen.getByText('Loading labels…')).toBeInTheDocument();

      setLabelKeys([], { error: new Error('boom') });
      await userEvent.click(screen.getByRole('button', { name: 'Collapse up' }));
      await expandMetric('up');

      expect(screen.getByText('Failed to load labels')).toBeInTheDocument();
    });

    // `aria-controls` has to name an element that is really there, so assert the id resolves rather
    // than that an attribute exists.
    it('points aria-controls at the block that appeared', async () => {
      setCatalog([row('up')]);
      setLabelKeys(['job']);
      renderList();

      await expandMetric('up');

      const toggle = screen.getByRole('button', { name: 'Collapse up' });
      const id = toggle.getAttribute('aria-controls');
      expect(id).toBeTruthy();
      expect(document.getElementById(id!)).toContainElement(screen.getByText('job'));
    });

    // A Prometheus 3.x UTF-8 metric name may contain a space, which in a space-separated
    // `aria-controls` token list would parse as several ids pointing nowhere.
    it('survives a metric name that needs escaping', async () => {
      setCatalog([row('weird name')]);
      setLabelKeys(['job']);
      renderList();

      await expandMetric('weird name');

      const id = screen.getByRole('button', { name: 'Collapse weird name' }).getAttribute('aria-controls');
      expect(id).not.toContain(' ');
      expect(document.getElementById(id!)).toContainElement(screen.getByText('job'));
    });
  });

  describe('expanding a label key', () => {
    const expandLabel = (key: string) =>
      userEvent.click(screen.getByRole('button', { name: `Show values for ${key}` }));

    const openJob = async () => {
      setCatalog([row('up')]);
      setLabelKeys(['job']);
      renderList();
      await expandMetric('up');
    };

    it('fires no value request while the label is collapsed', async () => {
      await openJob();

      expect(useLabelValuesMock).not.toHaveBeenCalled();
    });

    it('reveals the label’s values', async () => {
      setLabelValues(['web-1', 'web-2']);
      await openJob();

      await expandLabel('job');

      expect(screen.getByText('web-1')).toBeInTheDocument();
      expect(useLabelValuesMock).toHaveBeenCalledWith(
        { uid: 'prom-uid', type: 'prometheus' },
        timeRange,
        'up',
        'job',
        true
      );
    });

    it('renders only the first batch of a high-cardinality label', async () => {
      setLabelValues(Array.from({ length: 100 }, (_, i) => `value-${i}`));
      await openJob();

      await expandLabel('job');

      expect(screen.getAllByTestId('signal-explorer-value-row')).toHaveLength(25);
    });

    it('filters within the values and reorders them', async () => {
      setLabelValues(['banana', 'apple', 'cherry']);
      await openJob();
      await expandLabel('job');
      const valueTexts = () => screen.getAllByTestId('signal-explorer-value-row').map((node) => node.textContent);
      expect(valueTexts()).toEqual(['apple', 'banana', 'cherry']);

      await userEvent.click(screen.getByRole('button', { name: 'Sort descending' }));
      expect(valueTexts()).toEqual(['cherry', 'banana', 'apple']);

      await userEvent.type(screen.getByRole('textbox', { name: 'Filter values' }), 'an');
      expect(valueTexts()).toEqual(['banana']);
    });

    it('forgets the expanded label when its metric collapses', async () => {
      setLabelValues(['web-1']);
      await openJob();
      await expandLabel('job');
      expect(screen.getByText('web-1')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Collapse up' }));
      await expandMetric('up');

      expect(screen.queryByText('web-1')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show values for job' })).toBeInTheDocument();
    });
  });
});
