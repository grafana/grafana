import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { memo } from 'react';
import { Provider } from 'react-redux';

import type { DataQuery, DataSourceRef, TimeRange } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import { __clearCache } from '../data/metricResourceClient';
import * as labelValuesModule from '../data/useLabelValues';
import * as catalogModule from '../data/useMetricCatalog';
import * as detailModule from '../data/useMetricDetail';
import { setSearchText, signalExplorerReducer } from '../state/signalExplorerSlice';
import type { MetricRow } from '../types';

import * as MetricRowModule from './MetricRow';
import { MetricTree, type MetricTreeProps } from './MetricTree';

jest.mock('@grafana/runtime/unstable', () => ({ getDataSourceInstance: jest.fn() }));

const dsRef: DataSourceRef = { uid: 'p1' };
const timeRange = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

const makeStore = () => configureStore({ reducer: { signalExplorer: signalExplorerReducer } });

function renderTree(props: Partial<MetricTreeProps> = {}, store = makeStore()) {
  render(
    <Provider store={store}>
      <MetricTree exploreId="left" refId="A" dsRef={dsRef} timeRange={timeRange} {...props} />
    </Provider>
  );
  return store;
}

const makeLanguageProvider = () => ({
  start: jest.fn().mockResolvedValue([]),
  retrieveMetrics: jest.fn().mockReturnValue(['up', 'http_requests_total']),
  retrieveMetricsMetadata: jest
    .fn()
    .mockReturnValue({ up: { type: 'gauge' }, http_requests_total: { type: 'counter' } }),
  queryLabelKeys: jest.fn().mockResolvedValue(['instance', 'job']),
  queryLabelValues: jest.fn().mockResolvedValue(['web-1', 'web-2']),
});

function mockHooks(opts: { metrics: MetricRow[]; labelKeys?: string[]; values?: string[] }) {
  const catalog = jest
    .spyOn(catalogModule, 'useMetricCatalog')
    .mockReturnValue({ metrics: opts.metrics, loading: false });
  const detail = jest
    .spyOn(detailModule, 'useMetricDetail')
    .mockImplementation((_dsRef, _timeRange, _metric, enabled) => ({
      labelKeys: enabled ? (opts.labelKeys ?? []) : [],
      loading: false,
    }));
  const values = jest
    .spyOn(labelValuesModule, 'useLabelValues')
    .mockImplementation((_dsRef, _timeRange, _metric, _labelKey, enabled) => ({
      values: enabled ? (opts.values ?? []) : [],
      loading: false,
    }));
  return { catalog, detail, values };
}

const valueTexts = () => screen.getAllByTestId('signal-explorer-value-row').map((node) => node.textContent);

describe('MetricTree', () => {
  beforeEach(() => {
    __clearCache();
    jest.mocked(getDataSourceInstance).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('laziness (real hooks, mocked datasource)', () => {
    it('fires zero label requests while every row is collapsed', async () => {
      const lp = makeLanguageProvider();
      jest.mocked(getDataSourceInstance).mockResolvedValue({ languageProvider: lp } as never);

      renderTree();

      expect(await screen.findByText('up')).toBeInTheDocument();
      expect(screen.getByText('http_requests_total')).toBeInTheDocument();
      expect(lp.queryLabelKeys).not.toHaveBeenCalled();
      expect(lp.queryLabelValues).not.toHaveBeenCalled();
    });

    it('fetches a metric’s label keys exactly once, and re-expanding does not refetch', async () => {
      const lp = makeLanguageProvider();
      jest.mocked(getDataSourceInstance).mockResolvedValue({ languageProvider: lp } as never);

      renderTree();
      await screen.findByText('up');

      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));

      expect(await screen.findByText('job')).toBeInTheDocument();
      expect(lp.queryLabelKeys).toHaveBeenCalledTimes(1);
      expect(lp.queryLabelKeys).toHaveBeenCalledWith(timeRange, '{__name__="up"}');

      await userEvent.click(screen.getByRole('button', { name: /collapse up/i }));
      expect(screen.queryByText('job')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));

      expect(await screen.findByText('job')).toBeInTheDocument();
      expect(lp.queryLabelKeys).toHaveBeenCalledTimes(1);
    });

    it('narrows only the card whose search text changed', async () => {
      const lp = makeLanguageProvider();
      jest.mocked(getDataSourceInstance).mockResolvedValue({ languageProvider: lp } as never);
      const store = makeStore();

      render(
        <Provider store={store}>
          <div data-testid="tree-A">
            <MetricTree exploreId="left" refId="A" dsRef={dsRef} timeRange={timeRange} />
          </div>
          <div data-testid="tree-B">
            <MetricTree exploreId="left" refId="B" dsRef={dsRef} timeRange={timeRange} />
          </div>
        </Provider>
      );
      await screen.findAllByText('up');

      act(() => {
        store.dispatch(setSearchText({ exploreId: 'left', refId: 'A', searchText: 'http' }));
      });

      const treeA = within(screen.getByTestId('tree-A'));
      const treeB = within(screen.getByTestId('tree-B'));
      expect(treeA.queryByText('up')).not.toBeInTheDocument();
      expect(treeA.getByText('http_requests_total')).toBeInTheDocument();
      expect(treeB.getByText('up')).toBeInTheDocument();
    });

    it('loads only the expanded label’s values, scoped to that metric and label', async () => {
      const lp = makeLanguageProvider();
      jest.mocked(getDataSourceInstance).mockResolvedValue({ languageProvider: lp } as never);

      renderTree();
      await screen.findByText('up');
      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));
      await screen.findByText('job');

      expect(lp.queryLabelValues).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /show values for job/i }));

      expect(await screen.findByText('web-1')).toBeInTheDocument();
      expect(lp.queryLabelValues).toHaveBeenCalledTimes(1);
      expect(lp.queryLabelValues).toHaveBeenCalledWith(timeRange, 'job', '{__name__="up"}');
    });
  });

  describe('rendering and interaction (mocked hooks)', () => {
    it('renders metric rows and lazily loads label keys on expand', async () => {
      const { detail } = mockHooks({
        metrics: [
          { name: 'up', type: 'gauge' },
          { name: 'http_requests_total', type: 'counter' },
        ],
        labelKeys: ['instance', 'job'],
      });

      renderTree();

      expect(screen.getByText('up')).toBeInTheDocument();
      expect(detail).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));

      expect(await screen.findByText('instance')).toBeInTheDocument();
      expect(detail).toHaveBeenCalledWith(dsRef, timeRange, 'up', true);
    });

    it('sorts metrics used by a query ahead of the rest and renders their refIds as badges', () => {
      mockHooks({
        metrics: [
          { name: 'aaa_unused', type: 'gauge' },
          { name: 'zzz_used', type: 'counter' },
        ],
      });

      renderTree({
        matchQueries: [
          { refId: 'A', expr: 'sum(zzz_used)' } as DataQuery,
          { refId: 'B', expr: 'zzz_used{job="x"}' } as DataQuery,
        ],
      });

      const rows = screen.getAllByTestId('signal-explorer-metric-row');
      expect(within(rows[0]).getByText('zzz_used')).toBeInTheDocument();
      expect(within(rows[0]).getByText('A')).toBeInTheDocument();
      expect(within(rows[0]).getByText('B')).toBeInTheDocument();
      expect(within(rows[1]).getByText('aaa_unused')).toBeInTheDocument();
    });

    it('badges only tokens this datasource knows as metrics', () => {
      mockHooks({ metrics: [{ name: 'up', type: 'gauge' }] });

      renderTree({
        matchQueries: [
          { refId: 'A', expr: 'sum(up) / rate(unknown_metric[5m])' } as DataQuery,
          { refId: 'C', expr: 'unknown_metric' } as DataQuery,
        ],
      });

      const row = screen.getAllByTestId('signal-explorer-metric-row')[0];
      expect(within(row).getByText('A')).toBeInTheDocument();
      expect(within(row).queryByText('C')).not.toBeInTheDocument();
    });

    it('passes row callbacks that keep their identity across re-renders', async () => {
      mockHooks({
        metrics: [
          { name: 'up', type: 'gauge' },
          { name: 'node_load1', type: 'gauge' },
        ],
        labelKeys: [],
      });
      // `MetricRow` is memoized; callbacks rebuilt per render would make that memo a no-op.
      const seen: MetricRowModule.MetricRowProps[] = [];
      jest.replaceProperty(
        MetricRowModule,
        'MetricRow',
        memo(function MetricRowProbe(props: MetricRowModule.MetricRowProps) {
          seen.push(props);
          return <button onClick={() => props.onToggleExpand(props.metric.name)}>{props.metric.name}</button>;
        })
      );

      renderTree();
      const beforeCount = seen.length;
      const before = seen[0];

      await userEvent.click(screen.getByText('up'));

      const after = seen[beforeCount];
      expect(after.onSelect).toBe(before.onSelect);
      expect(after.onToggleExpand).toBe(before.onToggleExpand);
    });

    it('renders its own empty state when the catalog resolves to nothing', () => {
      mockHooks({ metrics: [] });

      renderTree();

      expect(screen.getByText(/no metrics found/i)).toBeInTheDocument();
    });

    it('dispatches setSelectedMetric when a metric name is clicked', async () => {
      mockHooks({ metrics: [{ name: 'up', type: 'gauge' }] });
      const store = renderTree();

      await userEvent.click(screen.getByRole('button', { name: 'up' }));

      expect(store.getState().signalExplorer.left.selectedMetric).toEqual({ refId: 'A', metricName: 'up' });
    });

    it('renders an inline loading state for the metric list', () => {
      jest.spyOn(catalogModule, 'useMetricCatalog').mockReturnValue({ metrics: [], loading: true });

      renderTree();

      expect(screen.getByText(/loading metrics/i)).toBeInTheDocument();
      expect(screen.queryByText(/no metrics found/i)).not.toBeInTheDocument();
    });

    it('renders an inline error state for the metric list', () => {
      jest
        .spyOn(catalogModule, 'useMetricCatalog')
        .mockReturnValue({ metrics: [], loading: false, error: new Error('boom') });

      renderTree();

      expect(screen.getByText(/failed to load metrics/i)).toBeInTheDocument();
      // An error is not an empty catalog; saying both would read as "loaded fine, found nothing".
      expect(screen.queryByText(/no metrics found/i)).not.toBeInTheDocument();
    });
  });

  describe('label loading and error states (mocked hooks)', () => {
    const expandUp = async () => {
      jest
        .spyOn(catalogModule, 'useMetricCatalog')
        .mockReturnValue({ metrics: [{ name: 'up', type: 'gauge' }], loading: false });
      renderTree();
      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));
    };

    it('renders an inline loading state while an expanded metric’s labels load', async () => {
      jest.spyOn(detailModule, 'useMetricDetail').mockReturnValue({ labelKeys: [], loading: true });

      await expandUp();

      expect(screen.getByText(/loading labels/i)).toBeInTheDocument();
    });

    it('renders an inline error state when an expanded metric’s labels fail', async () => {
      jest
        .spyOn(detailModule, 'useMetricDetail')
        .mockReturnValue({ labelKeys: [], loading: false, error: new Error('boom') });

      await expandUp();

      expect(screen.getByText(/failed to load labels/i)).toBeInTheDocument();
    });

    it('renders an inline loading state while an expanded label’s values load', async () => {
      jest.spyOn(detailModule, 'useMetricDetail').mockReturnValue({ labelKeys: ['job'], loading: false });
      jest.spyOn(labelValuesModule, 'useLabelValues').mockReturnValue({ values: [], loading: true });

      await expandUp();
      await userEvent.click(screen.getByRole('button', { name: /show values for job/i }));

      expect(screen.getByText(/loading values/i)).toBeInTheDocument();
    });

    it('renders an inline error state when an expanded label’s values fail', async () => {
      jest.spyOn(detailModule, 'useMetricDetail').mockReturnValue({ labelKeys: ['job'], loading: false });
      jest
        .spyOn(labelValuesModule, 'useLabelValues')
        .mockReturnValue({ values: [], loading: false, error: new Error('boom') });

      await expandUp();
      await userEvent.click(screen.getByRole('button', { name: /show values for job/i }));

      expect(screen.getByText(/failed to load values/i)).toBeInTheDocument();
    });
  });

  describe('single-expansion accordion (mocked hooks)', () => {
    /** Label keys that name their own metric, so the DOM says which metric is expanded. */
    function mockAccordionHooks() {
      jest.spyOn(catalogModule, 'useMetricCatalog').mockReturnValue({
        metrics: [
          { name: 'up', type: 'gauge' },
          { name: 'node_load1', type: 'gauge' },
        ],
        loading: false,
      });
      jest.spyOn(detailModule, 'useMetricDetail').mockImplementation((_dsRef, _timeRange, metric, enabled) => ({
        labelKeys: enabled ? [`job_of_${metric}`] : [],
        loading: false,
      }));
      jest
        .spyOn(labelValuesModule, 'useLabelValues')
        .mockImplementation((_dsRef, _timeRange, _metric, _labelKey, enabled) => ({
          values: enabled ? ['web-1'] : [],
          loading: false,
        }));
    }

    it('collapses the previously expanded metric when another one is expanded', async () => {
      mockAccordionHooks();
      renderTree();

      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));
      expect(screen.getByText('job_of_up')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /expand node_load1/i }));

      expect(screen.queryByText('job_of_up')).not.toBeInTheDocument();
      expect(screen.getByText('job_of_node_load1')).toBeInTheDocument();
    });

    it('forgets the expanded label, so re-expanding a metric shows its labels collapsed', async () => {
      mockAccordionHooks();
      renderTree();

      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));
      await userEvent.click(screen.getByRole('button', { name: /show values for job_of_up/i }));
      expect(screen.getAllByTestId('signal-explorer-value-row')).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', { name: /expand node_load1/i }));
      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));

      // `up` is expanded again, but its label is not — a stale expanded label would otherwise pop
      // values open under a metric the user only just re-opened.
      expect(screen.getByText('job_of_up')).toBeInTheDocument();
      expect(screen.queryByTestId('signal-explorer-value-row')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show values for job_of_up/i })).toBeInTheDocument();
    });
  });

  describe('scroll structure (mocked hooks)', () => {
    // The rows scroll inside their own region so the card's search box stays pinned above them.
    // Paging in a few hundred metrics used to scroll the search box out of the card entirely.
    it('renders the rows inside a dedicated scroll region', () => {
      mockHooks({
        metrics: [
          { name: 'up', type: 'gauge' },
          { name: 'node_load1', type: 'gauge' },
        ],
      });

      renderTree();

      const list = screen.getByTestId('signal-explorer-metric-list');
      for (const row of screen.getAllByTestId('signal-explorer-metric-row')) {
        expect(list).toContainElement(row);
      }
    });

    it('keeps the paging control with the rows it pages', async () => {
      mockHooks({ metrics: Array.from({ length: 60 }, (_, i) => ({ name: `m_${i}`, type: 'gauge' as const })) });

      renderTree();

      const list = screen.getByTestId('signal-explorer-metric-list');
      expect(list).toContainElement(screen.getByRole('button', { name: /show more/i }));
      await userEvent.click(screen.getByRole('button', { name: /show more/i }));
      expect(screen.getAllByTestId('signal-explorer-metric-row')).toHaveLength(50);
    });

    // A status line outside the scroll region stays visible no matter how far down the list is.
    it('keeps the loading message out of the scroll region', () => {
      jest.spyOn(catalogModule, 'useMetricCatalog').mockReturnValue({ metrics: [], loading: true });

      renderTree();

      expect(screen.getByTestId('signal-explorer-metric-list')).not.toContainElement(
        screen.getByText(/loading metrics/i)
      );
    });
  });

  describe('aria-controls wiring (mocked hooks)', () => {
    function mockNamedHooks() {
      jest.spyOn(catalogModule, 'useMetricCatalog').mockReturnValue({
        metrics: [{ name: 'up', type: 'gauge' }],
        loading: false,
      });
      jest.spyOn(detailModule, 'useMetricDetail').mockImplementation((_dsRef, _timeRange, _metric, enabled) => ({
        labelKeys: enabled ? ['job'] : [],
        loading: false,
      }));
      jest
        .spyOn(labelValuesModule, 'useLabelValues')
        .mockImplementation((_dsRef, _timeRange, _metric, _labelKey, enabled) => ({
          values: enabled ? ['web-1'] : [],
          loading: false,
        }));
    }

    /** The element an expanded toggle claims to control, resolved through the document. */
    const controlledBy = (button: HTMLElement) => {
      const id = button.getAttribute('aria-controls');
      expect(id).toBeTruthy();
      return document.getElementById(id!);
    };

    it('points a metric’s toggle at the labels block it opens', async () => {
      mockNamedHooks();
      renderTree();

      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));

      const controlled = controlledBy(screen.getByRole('button', { name: /collapse up/i }));
      expect(controlled).toBeInTheDocument();
      expect(controlled).toContainElement(screen.getByText('job'));
    });

    it('points a label’s toggle at the values block it opens', async () => {
      mockNamedHooks();
      renderTree();

      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));
      await userEvent.click(screen.getByRole('button', { name: /show values for job/i }));

      const controlled = controlledBy(screen.getByRole('button', { name: /hide values for job/i }));
      expect(controlled).toBeInTheDocument();
      expect(controlled).toContainElement(screen.getByTestId('signal-explorer-value-row'));
    });

    // Two cards in a mixed pane render the same metric names, and duplicate ids would make each
    // toggle resolve to whichever block happens to come first in the document.
    it('gives two trees showing the same metric distinct ids', async () => {
      mockNamedHooks();
      const store = makeStore();
      render(
        <Provider store={store}>
          <MetricTree exploreId="left" refId="A" dsRef={dsRef} timeRange={timeRange} />
          <MetricTree exploreId="left" refId="B" dsRef={dsRef} timeRange={timeRange} />
        </Provider>
      );

      const [expandA, expandB] = screen.getAllByRole('button', { name: /expand up/i });
      await userEvent.click(expandA);
      await userEvent.click(expandB);

      const [collapseA, collapseB] = screen.getAllByRole('button', { name: /collapse up/i });
      const idA = collapseA.getAttribute('aria-controls');
      const idB = collapseB.getAttribute('aria-controls');
      expect(idA).toBeTruthy();
      expect(idA).not.toBe(idB);
      expect(document.querySelectorAll(`[id="${idA}"]`)).toHaveLength(1);
    });

    it('builds a usable id from a metric name that needs escaping', async () => {
      jest.spyOn(catalogModule, 'useMetricCatalog').mockReturnValue({
        metrics: [{ name: 'a metric "with" spaces', type: 'gauge' }],
        loading: false,
      });
      jest.spyOn(detailModule, 'useMetricDetail').mockImplementation((_dsRef, _timeRange, _metric, enabled) => ({
        labelKeys: enabled ? ['job'] : [],
        loading: false,
      }));
      renderTree();

      await userEvent.click(screen.getByRole('button', { name: /expand a metric/i }));

      const id = screen.getByRole('button', { name: /collapse a metric/i }).getAttribute('aria-controls');
      // aria-controls is a space-separated id list, so a raw name would parse as several ids.
      expect(id).not.toContain(' ');
      expect(document.getElementById(id!)).toContainElement(screen.getByText('job'));
    });
  });

  describe('metric list pagination (mocked hooks)', () => {
    const manyMetrics: MetricRow[] = Array.from({ length: 5000 }, (_, i) => ({
      name: `metric_${String(i).padStart(4, '0')}`,
      type: 'gauge',
    }));

    const rowCount = () => screen.getAllByTestId('signal-explorer-metric-row').length;

    it('renders only the first batch of a large catalog and pages with “show more”', async () => {
      mockHooks({ metrics: manyMetrics });

      renderTree();

      expect(rowCount()).toBe(25);

      await userEvent.click(screen.getByRole('button', { name: /show more/i }));

      expect(rowCount()).toBe(50);
    });

    it('resets paging back to the first batch when the datasource changes', async () => {
      mockHooks({ metrics: manyMetrics });
      const store = makeStore();
      const tree = (ref: DataSourceRef) => (
        <Provider store={store}>
          <MetricTree exploreId="left" refId="A" dsRef={ref} timeRange={timeRange} />
        </Provider>
      );

      const { rerender } = render(tree({ uid: 'p1' }));
      await userEvent.click(screen.getByRole('button', { name: /show more/i }));
      expect(rowCount()).toBe(50);

      // A different catalog entirely — a page offset into the old one means nothing in the new one.
      rerender(tree({ uid: 'p2' }));

      expect(rowCount()).toBe(25);
    });

    it('resets paging back to the first batch when the time range changes', async () => {
      mockHooks({ metrics: manyMetrics });
      const store = makeStore();
      const range = (from: string) => ({ raw: { from, to: 'now' }, from: {}, to: {} }) as unknown as TimeRange;
      const tree = (tr: TimeRange) => (
        <Provider store={store}>
          <MetricTree exploreId="left" refId="A" dsRef={dsRef} timeRange={tr} />
        </Provider>
      );

      const { rerender } = render(tree(range('now-1h')));
      await userEvent.click(screen.getByRole('button', { name: /show more/i }));
      expect(rowCount()).toBe(50);

      rerender(tree(range('now-6h')));

      expect(rowCount()).toBe(25);
    });

    it('resets paging back to the first batch when the search changes', async () => {
      mockHooks({ metrics: manyMetrics });
      const store = makeStore();

      renderTree({}, store);
      await userEvent.click(screen.getByRole('button', { name: /show more/i }));
      expect(rowCount()).toBe(50);

      act(() => {
        store.dispatch(setSearchText({ exploreId: 'left', refId: 'A', searchText: 'metric_1' }));
      });

      expect(rowCount()).toBe(25);
    });
  });

  describe('label values pagination, filtering and sorting (mocked hooks)', () => {
    const manyValues = Array.from({ length: 5000 }, (_, i) => `value-${String(i).padStart(4, '0')}`);

    async function expandToValues(values: string[]) {
      mockHooks({ metrics: [{ name: 'up', type: 'gauge' }], labelKeys: ['job'], values });
      renderTree();
      await userEvent.click(screen.getByRole('button', { name: /expand up/i }));
      await userEvent.click(screen.getByRole('button', { name: /show values for job/i }));
    }

    it('renders only the first batch of a high-cardinality label and pages with “show more”', async () => {
      await expandToValues(manyValues);

      expect(screen.getAllByTestId('signal-explorer-value-row')).toHaveLength(25);

      await userEvent.click(screen.getByRole('button', { name: /show more/i }));

      expect(screen.getAllByTestId('signal-explorer-value-row')).toHaveLength(50);
    });

    it('filters within the values and resets pagination back to the first batch', async () => {
      await expandToValues(manyValues);
      await userEvent.click(screen.getByRole('button', { name: /show more/i }));
      expect(screen.getAllByTestId('signal-explorer-value-row')).toHaveLength(50);

      // 1000 matches, so a stale offset would still render 50 rows here.
      await userEvent.type(screen.getByRole('textbox', { name: /filter values/i }), 'value-1');
      expect(screen.getAllByTestId('signal-explorer-value-row')).toHaveLength(25);

      await userEvent.type(screen.getByRole('textbox', { name: /filter values/i }), '234');
      expect(valueTexts()).toEqual(['value-1234']);
    });

    it('reverses the rendered value order with the sort toggle', async () => {
      await expandToValues(['banana', 'apple', 'cherry']);

      expect(valueTexts()).toEqual(['apple', 'banana', 'cherry']);

      await userEvent.click(screen.getByRole('button', { name: /sort descending/i }));

      expect(valueTexts()).toEqual(['cherry', 'banana', 'apple']);
    });
  });

  describe('host-supplied catalog', () => {
    it('renders the host’s catalog and runs no catalog request of its own', async () => {
      const lp = makeLanguageProvider();
      jest.mocked(getDataSourceInstance).mockResolvedValue({ languageProvider: lp } as never);

      renderTree({
        catalog: { metrics: [{ name: 'host_metric_total', type: 'counter' }], loading: false },
      });

      expect(await screen.findByText('host_metric_total')).toBeInTheDocument();
      // The tree's own `useMetricCatalog` would call `start()` on the way to the catalog.
      expect(lp.start).not.toHaveBeenCalled();
      // And the datasource's own metrics, which the tree would have fetched, are nowhere.
      expect(screen.queryByText('up')).not.toBeInTheDocument();
    });

    it('reports the host catalog’s loading state', () => {
      renderTree({ catalog: { metrics: [], loading: true } });

      expect(screen.getByText(/loading metrics/i)).toBeInTheDocument();
    });

    it('reports the host catalog’s error', () => {
      renderTree({ catalog: { metrics: [], loading: false, error: new Error('boom') } });

      expect(screen.getByText(/failed to load metrics/i)).toBeInTheDocument();
    });
  });
});
