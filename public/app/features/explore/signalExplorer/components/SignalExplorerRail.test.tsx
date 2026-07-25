import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';

import type { DataQuery, DataSourceApi, DataSourceInstanceSettings, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';

import * as catalogModule from '../data/useMetricCatalog';
import { signalExplorerReducer, type SignalExplorerState } from '../state/signalExplorerSlice';

import * as DatasourceCardModule from './DatasourceCard';
import { SignalExplorerRail } from './SignalExplorerRail';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

mockComboboxRect();

const timeRange = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

function makeSettings(uid: string, name: string, pluginId: string): DataSourceInstanceSettings {
  return {
    uid,
    name,
    type: pluginId,
    meta: { id: pluginId, info: { logos: { small: `/${pluginId}.svg` } } },
  } as unknown as DataSourceInstanceSettings;
}

const PROM = makeSettings('p1', 'Prometheus', 'prometheus');
const PROM_TWO = makeSettings('p2', 'Prometheus two', 'prometheus');
const AMAZON_PROM = makeSettings('a1', 'Amazon Prometheus', 'grafana-amazonprometheus-datasource');
const LOKI = makeSettings('l1', 'Loki', 'loki');

/** Resolves the given settings by uid, and anything else to `undefined` (a deleted datasource). */
function mockDatasources(...all: DataSourceInstanceSettings[]) {
  const byUid = new Map(all.map((settings) => [settings.uid, settings]));
  jest.mocked(getDataSourceSrv).mockReturnValue({
    getInstanceSettings: (ref: string | { uid?: string } | null | undefined) =>
      byUid.get(typeof ref === 'string' ? ref : (ref?.uid ?? '')),
  } as unknown as ReturnType<typeof getDataSourceSrv>);
}

const mixedInstance = {
  meta: { mixed: true },
  getRef: () => ({ uid: '-- Mixed --', type: 'datasource' }),
} as unknown as DataSourceApi;

function promInstance(settings: DataSourceInstanceSettings) {
  return {
    meta: settings.meta,
    getRef: () => ({ uid: settings.uid, type: settings.type }),
  } as unknown as DataSourceApi;
}

interface RenderOptions {
  queries: DataQuery[];
  datasourceInstance?: DataSourceApi;
  signalExplorer?: SignalExplorerState;
}

interface ExploreStubState {
  panes: Record<string, { queries: DataQuery[]; range: TimeRange; datasourceInstance?: DataSourceApi }>;
}

function renderRail({ queries, datasourceInstance, signalExplorer = {} }: RenderOptions) {
  const exploreState: ExploreStubState = { panes: { left: { queries, range: timeRange, datasourceInstance } } };
  const store = configureStore({
    reducer: {
      signalExplorer: signalExplorerReducer,
      explore: (state: ExploreStubState = exploreState): ExploreStubState => state,
    },
    preloadedState: { signalExplorer },
  });

  render(
    <Provider store={store}>
      <SignalExplorerRail exploreId="left" />
    </Provider>
  );

  return store;
}

const cardSentinels = () => screen.getAllByTestId('card-sentinel');

describe('SignalExplorerRail', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with sentinel cards', () => {
    beforeEach(() => {
      jest
        .spyOn(DatasourceCardModule, 'DatasourceCard')
        .mockImplementation(({ refId, dsRef, dsName, isPrometheus, isActive }) => (
          <div
            data-testid="card-sentinel"
            data-refid={refId}
            data-dsuid={dsRef.uid ?? ''}
            data-dsname={dsName}
            data-isprometheus={String(isPrometheus)}
            data-isactive={String(isActive)}
          />
        ));
    });

    it('renders one card per query, hosting the tree only for the Prometheus one', () => {
      mockDatasources(PROM, LOKI);

      renderRail({
        queries: [
          { refId: 'A', datasource: { uid: 'p1' } },
          { refId: 'B', datasource: { uid: 'l1' } },
        ],
      });

      const cards = cardSentinels();
      expect(cards).toHaveLength(2);
      expect(cards[0]).toHaveAttribute('data-refid', 'A');
      expect(cards[0]).toHaveAttribute('data-isprometheus', 'true');
      expect(cards[1]).toHaveAttribute('data-refid', 'B');
      expect(cards[1]).toHaveAttribute('data-isprometheus', 'false');
    });

    it('marks the card matching the slice activeRefId as active', () => {
      mockDatasources(PROM, LOKI);

      renderRail({
        queries: [
          { refId: 'A', datasource: { uid: 'p1' } },
          { refId: 'B', datasource: { uid: 'l1' } },
        ],
        signalExplorer: { left: { typeFilter: null, searchText: '', activeRefId: 'B' } },
      });

      const cards = cardSentinels();
      expect(cards[0]).toHaveAttribute('data-isactive', 'false');
      expect(cards[1]).toHaveAttribute('data-isactive', 'true');
    });

    it('gives each card its own datasource in a mixed pane, never the pane Mixed ref', () => {
      mockDatasources(PROM, PROM_TWO);

      renderRail({
        queries: [
          { refId: 'A', datasource: { uid: 'p1' } },
          { refId: 'B', datasource: { uid: 'p2' } },
        ],
        datasourceInstance: mixedInstance,
      });

      const uids = cardSentinels().map((card) => card.getAttribute('data-dsuid'));
      expect(uids).toEqual(['p1', 'p2']);
      expect(uids).not.toContain('-- Mixed --');
    });

    it('falls back to the pane datasource for a query that does not carry its own', () => {
      mockDatasources(PROM);

      renderRail({ queries: [{ refId: 'A' }], datasourceInstance: promInstance(PROM) });

      expect(cardSentinels()[0]).toHaveAttribute('data-dsuid', 'p1');
    });

    it('treats a managed Prometheus flavour as Prometheus', () => {
      mockDatasources(AMAZON_PROM);

      renderRail({ queries: [{ refId: 'A', datasource: { uid: 'a1' } }] });

      expect(cardSentinels()[0]).toHaveAttribute('data-isprometheus', 'true');
    });

    it('renders a query whose datasource cannot be resolved without crashing', () => {
      mockDatasources(PROM);

      renderRail({
        queries: [
          { refId: 'A', datasource: { uid: 'p1' } },
          { refId: 'B', datasource: { uid: 'deleted' } },
        ],
      });

      const cards = cardSentinels();
      expect(cards).toHaveLength(2);
      expect(cards[1]).toHaveAttribute('data-dsname', 'Unknown datasource');
      expect(cards[1]).toHaveAttribute('data-isprometheus', 'false');
    });
  });

  describe('metadata dock', () => {
    beforeEach(() => {
      mockDatasources(PROM);
      jest.spyOn(DatasourceCardModule, 'DatasourceCard').mockImplementation(() => <div data-testid="card-sentinel" />);
      jest.spyOn(catalogModule, 'useMetricCatalog').mockReturnValue({
        metrics: [{ name: 'up', type: 'gauge', help: 'Target liveness', unit: 'short' }],
        loading: false,
      });
    });

    it('prompts for a selection when the slice has none', () => {
      renderRail({ queries: [{ refId: 'A', datasource: { uid: 'p1' } }] });

      expect(screen.getByText(/select a metric to see its details/i)).toBeInTheDocument();
    });

    it('populates from the slice selectedMetric', () => {
      renderRail({
        queries: [{ refId: 'A', datasource: { uid: 'p1' } }],
        signalExplorer: {
          left: { typeFilter: null, searchText: '', selectedMetric: { refId: 'A', metricName: 'up' } },
        },
      });

      expect(screen.getByRole('heading', { name: 'up' })).toBeInTheDocument();
      expect(screen.getByText('Target liveness')).toBeInTheDocument();
      expect(screen.getByTestId('metric-metadata-unit')).toHaveTextContent('short');
    });

    it('clears the selection when the block is closed', async () => {
      const store = renderRail({
        queries: [{ refId: 'A', datasource: { uid: 'p1' } }],
        signalExplorer: {
          left: { typeFilter: null, searchText: '', selectedMetric: { refId: 'A', metricName: 'up' } },
        },
      });

      await userEvent.click(screen.getByRole('button', { name: /close/i }));

      expect(store.getState().signalExplorer.left.selectedMetric).toBeUndefined();
      expect(screen.getByText(/select a metric to see its details/i)).toBeInTheDocument();
    });
  });

  describe('with real cards', () => {
    beforeEach(() => {
      mockDatasources(PROM, LOKI);
      jest.spyOn(catalogModule, 'useMetricCatalog').mockReturnValue({
        metrics: [
          { name: 'up', type: 'gauge' },
          { name: 'node_load1', type: 'gauge' },
        ],
        loading: false,
      });
    });

    const twoQueries: DataQuery[] = [
      { refId: 'A', datasource: { uid: 'p1' }, expr: 'up + node_load1' } as DataQuery,
      { refId: 'B', datasource: { uid: 'l1' }, expr: 'sum(up)' } as DataQuery,
    ];

    const badgesFor = (metricName: string) => {
      const row = screen.getByText(metricName).closest('[data-testid="signal-explorer-metric-row"]');
      return within(row as HTMLElement)
        .getAllByText(/^[A-Z]$/)
        .map((node) => node.textContent);
    };

    it('hosts the metric tree on the Prometheus card and the placeholder on the other', async () => {
      renderRail({
        queries: twoQueries,
        signalExplorer: { left: { typeFilter: null, searchText: '', activeRefId: 'A' } },
      });
      await userEvent.click(screen.getByRole('button', { name: /expand loki/i }));

      const [prometheusCard, lokiCard] = screen.getAllByTestId('signal-explorer-datasource-card');
      expect(within(prometheusCard).getAllByTestId('signal-explorer-metric-row')).toHaveLength(2);
      expect(within(lokiCard).getByText(/nothing to browse/i)).toBeInTheDocument();
      expect(within(lokiCard).queryByTestId('signal-explorer-metric-row')).not.toBeInTheDocument();
    });

    it('badges a metric with every refId in the pane that references it, not just its own card', () => {
      renderRail({
        queries: twoQueries,
        signalExplorer: { left: { typeFilter: null, searchText: '', activeRefId: 'A' } },
      });

      expect(badgesFor('up')).toEqual(['A', 'B']);
      expect(badgesFor('node_load1')).toEqual(['A']);
    });

    it('never mutates the pane queries', async () => {
      const store = renderRail({
        queries: twoQueries,
        signalExplorer: { left: { typeFilter: null, searchText: '', activeRefId: 'A' } },
      });

      await userEvent.click(screen.getByRole('button', { name: 'up' }));
      await userEvent.click(screen.getByRole('button', { name: /expand loki/i }));

      expect(store.getState().explore.panes.left.queries).toBe(twoQueries);
      expect(twoQueries).toEqual([
        { refId: 'A', datasource: { uid: 'p1' }, expr: 'up + node_load1' },
        { refId: 'B', datasource: { uid: 'l1' }, expr: 'sum(up)' },
      ]);
    });
  });
});
