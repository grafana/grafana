import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { Provider } from 'react-redux';

import type { DataQuery, DataSourceInstanceSettings, DataSourceRef, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';

import * as catalogModule from '../data/useMetricCatalog';
import { signalExplorerReducer } from '../state/signalExplorerSlice';

import { DatasourceCard } from './DatasourceCard';
import * as MetricTreeModule from './MetricTree';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

mockComboboxRect();

const dsRef: DataSourceRef = { uid: 'p1' };
const timeRange = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

function mockInstanceSettings(settings: Partial<DataSourceInstanceSettings> | undefined) {
  jest.mocked(getDataSourceSrv).mockReturnValue({
    getInstanceSettings: jest.fn().mockReturnValue(settings),
  } as unknown as ReturnType<typeof getDataSourceSrv>);
}

const makeStore = () => configureStore({ reducer: { signalExplorer: signalExplorerReducer } });

function renderCard(props: Partial<ComponentProps<typeof DatasourceCard>> = {}, store = makeStore()) {
  render(
    <Provider store={store}>
      <DatasourceCard
        exploreId="left"
        refId="A"
        dsRef={dsRef}
        dsName="Prometheus"
        isPrometheus
        isActive
        timeRange={timeRange}
        paneQueries={[]}
        {...props}
      />
    </Provider>
  );
  return store;
}

describe('DatasourceCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with a sentinel MetricTree', () => {
    beforeEach(() => {
      mockInstanceSettings({ meta: { info: { logos: { small: '/logo.svg' } } } } as DataSourceInstanceSettings);
      jest.spyOn(MetricTreeModule, 'MetricTree').mockImplementation(() => <div data-testid="metric-tree-sentinel" />);
      jest
        .spyOn(catalogModule, 'useMetricCatalog')
        .mockReturnValue({ metrics: [{ name: 'up', type: 'gauge' }], loading: false });
    });

    it('renders the metric tree for a Prometheus datasource', () => {
      renderCard();

      expect(screen.getByTestId('metric-tree-sentinel')).toBeInTheDocument();
    });

    it('badges each catalog metric with every pane refId referencing it, ignoring unknown tokens', () => {
      const tree = jest.mocked(MetricTreeModule.MetricTree);

      renderCard({
        paneQueries: [
          { refId: 'A', expr: 'sum(up) / rate(unknown_metric[5m])' } as DataQuery,
          { refId: 'B', expr: 'up{job="x"}' } as DataQuery,
          { refId: 'C', expr: 'unknown_metric' } as DataQuery,
        ],
      });

      expect(tree.mock.calls[0][0].queryRefsByMetric).toEqual({ up: ['A', 'B'] });
    });

    it('renders a placeholder and no tree for a non-Prometheus datasource', () => {
      renderCard({ isPrometheus: false });

      expect(screen.getByText(/nothing to browse/i)).toBeInTheDocument();
      expect(screen.queryByTestId('metric-tree-sentinel')).not.toBeInTheDocument();
    });

    it('renders no search input or type filter for a non-Prometheus datasource', () => {
      renderCard({ isPrometheus: false });

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('dispatches setSearchText as the user types', async () => {
      const store = renderCard();

      await userEvent.type(screen.getByRole('textbox', { name: /search metrics/i }), 'up');

      expect(store.getState().signalExplorer.left.searchText).toBe('up');
    });

    it('dispatches setTypeFilter when the type filter changes', async () => {
      const store = renderCard();

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByText('Counter'));

      expect(store.getState().signalExplorer.left.typeFilter).toBe('counter');
    });

    it('dispatches setActiveRefId when the card is activated', async () => {
      const store = renderCard({ isActive: false });

      await userEvent.click(screen.getByRole('button', { name: /expand prometheus/i }));

      expect(store.getState().signalExplorer.left.activeRefId).toBe('A');
    });

    it('renders the datasource logo when instance settings resolve', () => {
      renderCard();

      expect(screen.getByTestId('signal-explorer-datasource-logo')).toHaveAttribute('src', '/logo.svg');
    });

    it('renders without crashing when the datasource cannot be resolved, and omits the logo', () => {
      mockInstanceSettings(undefined);

      renderCard();

      expect(screen.getByText('Prometheus')).toBeInTheDocument();
      expect(screen.queryByTestId('signal-explorer-datasource-logo')).not.toBeInTheDocument();
    });
  });

  describe('empty catalog (real MetricTree)', () => {
    beforeEach(() => {
      mockInstanceSettings({ meta: { info: { logos: { small: '/logo.svg' } } } } as DataSourceInstanceSettings);
      jest.spyOn(catalogModule, 'useMetricCatalog').mockReturnValue({ metrics: [], loading: false });
    });

    it("renders the card's own empty message instead of a blank body", () => {
      renderCard();

      expect(screen.getByText(/no metrics found/i)).toBeInTheDocument();
    });
  });
});
