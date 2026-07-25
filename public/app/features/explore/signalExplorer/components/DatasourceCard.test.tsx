import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { Provider } from 'react-redux';

import type { DataQuery, DataSourceInstanceSettings, DataSourceRef, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';

import * as catalogModule from '../data/useMetricCatalog';
import { setSearchText, signalExplorerReducer } from '../state/signalExplorerSlice';

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

const cardProps: ComponentProps<typeof DatasourceCard> = {
  exploreId: 'left',
  refId: 'A',
  dsRef,
  dsName: 'Prometheus',
  isPrometheus: true,
  isActive: true,
  timeRange,
  matchQueries: [],
};

function renderCard(props: Partial<ComponentProps<typeof DatasourceCard>> = {}, store = makeStore()) {
  render(
    <Provider store={store}>
      <DatasourceCard {...cardProps} {...props} />
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

    it('hands the tree the queries whose refIds may badge its metrics', () => {
      const tree = jest.mocked(MetricTreeModule.MetricTree);
      const matchQueries = [
        { refId: 'A', expr: 'sum(up)' } as DataQuery,
        { refId: 'B', expr: 'up{job="x"}' } as DataQuery,
      ];

      renderCard({ matchQueries });

      expect(tree.mock.calls[0][0].matchQueries).toBe(matchQueries);
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

    it('keeps the search input responsive but only dispatches setSearchText once typing settles', async () => {
      const store = renderCard();

      const input = screen.getByRole('textbox', { name: /search metrics/i });
      await userEvent.type(input, 'up');

      // The input paints every keystroke; the store does not see any of them yet.
      expect(input).toHaveValue('up');
      expect(store.getState().signalExplorer.left).toBeUndefined();

      await waitFor(() => expect(store.getState().signalExplorer.left.cards['A'].searchText).toBe('up'));
    });

    it('adopts a search text set for this card from outside the input', async () => {
      const store = renderCard();

      act(() => {
        store.dispatch(setSearchText({ exploreId: 'left', refId: 'A', searchText: 'node_' }));
      });

      await waitFor(() => expect(screen.getByRole('textbox', { name: /search metrics/i })).toHaveValue('node_'));
    });

    it('leaves a sibling card’s search box alone when this one is typed in', async () => {
      const store = makeStore();
      render(
        <Provider store={store}>
          <DatasourceCard {...cardProps} refId="A" dsName="Prom A" />
          <DatasourceCard {...cardProps} refId="B" dsName="Prom B" />
        </Provider>
      );

      const [inputA, inputB] = screen.getAllByRole('textbox', { name: /search metrics/i });
      await userEvent.type(inputA, 'node_');
      await waitFor(() => expect(store.getState().signalExplorer.left.cards['A'].searchText).toBe('node_'));

      expect(inputB).toHaveValue('');
      expect(store.getState().signalExplorer.left.cards['B']).toBeUndefined();
    });

    it('dispatches setTypeFilter when the type filter changes', async () => {
      const store = renderCard();

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByText('Counter'));

      expect(store.getState().signalExplorer.left.cards['A'].typeFilter).toBe('counter');
    });

    it('leaves a sibling card’s type filter alone when this one is changed', async () => {
      const store = makeStore();
      render(
        <Provider store={store}>
          <DatasourceCard {...cardProps} refId="A" dsName="Prom A" />
          <DatasourceCard {...cardProps} refId="B" dsName="Prom B" />
        </Provider>
      );

      await userEvent.click(screen.getAllByRole('combobox')[0]);
      await userEvent.click(await screen.findByText('Counter'));

      expect(store.getState().signalExplorer.left.cards['A'].typeFilter).toBe('counter');
      expect(store.getState().signalExplorer.left.cards['B']).toBeUndefined();
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

    it('renders an empty message rather than a blank body', () => {
      renderCard();

      expect(screen.getByText(/no metrics found/i)).toBeInTheDocument();
    });

    it('reads the catalog exactly once for an expanded card', () => {
      const catalog = jest.mocked(catalogModule.useMetricCatalog);

      renderCard();

      expect(catalog).toHaveBeenCalledTimes(1);
    });
  });
});
