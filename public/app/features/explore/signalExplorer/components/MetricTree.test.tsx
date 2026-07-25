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
import { MetricTree } from './MetricTree';

jest.mock('@grafana/runtime/unstable', () => ({ getDataSourceInstance: jest.fn() }));

const dsRef: DataSourceRef = { uid: 'p1' };
const timeRange = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

const makeStore = () => configureStore({ reducer: { signalExplorer: signalExplorerReducer } });

function renderTree(props: { matchQueries?: DataQuery[] } = {}, store = makeStore()) {
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

    it('renders inline loading and error states for the metric list', () => {
      jest
        .spyOn(catalogModule, 'useMetricCatalog')
        .mockReturnValueOnce({ metrics: [], loading: true })
        .mockReturnValue({ metrics: [], loading: false, error: new Error('boom') });

      const { unmount } = render(
        <Provider store={makeStore()}>
          <MetricTree exploreId="left" refId="A" dsRef={dsRef} timeRange={timeRange} />
        </Provider>
      );
      expect(screen.getByText(/loading metrics/i)).toBeInTheDocument();
      unmount();

      renderTree();
      expect(screen.getByText(/failed to load metrics/i)).toBeInTheDocument();
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
});
