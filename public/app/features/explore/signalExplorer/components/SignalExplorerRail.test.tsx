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

    // Explore renders the rail from a pane id; a split close removes the pane while the tree is
    // still mounted, and nothing below can be fetched without a range.
    it('renders nothing at all for a pane that is not open', () => {
      const store = configureStore({
        reducer: {
          signalExplorer: signalExplorerReducer,
          explore: (state: ExploreStubState = { panes: {} }): ExploreStubState => state,
        },
      });

      render(
        <Provider store={store}>
          <SignalExplorerRail exploreId="left" />
        </Provider>
      );

      expect(screen.queryByTestId('signal-explorer-rail')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-sentinel')).not.toBeInTheDocument();
    });

    it('marks the card matching the slice activeRefId as active', () => {
      mockDatasources(PROM, LOKI);

      renderRail({
        queries: [
          { refId: 'A', datasource: { uid: 'p1' } },
          { refId: 'B', datasource: { uid: 'l1' } },
        ],
        signalExplorer: { left: { cards: {}, activeRefId: 'B' } },
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

    // No selection means no dock. An empty panel explaining itself would sit in the sidebar
    // permanently, costing width the metric list needs.
    it('renders no metadata dock at all when the slice has no selection', () => {
      renderRail({ queries: [{ refId: 'A', datasource: { uid: 'p1' } }] });

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });

    it('populates from the slice selectedMetric', () => {
      renderRail({
        queries: [{ refId: 'A', datasource: { uid: 'p1' } }],
        signalExplorer: {
          left: { cards: {}, selectedMetric: { refId: 'A', metricName: 'up' } },
        },
      });

      expect(screen.getByRole('heading', { name: 'up' })).toBeInTheDocument();
      expect(screen.getByText('Target liveness')).toBeInTheDocument();
      expect(screen.getByTestId('metric-metadata-unit')).toHaveTextContent('short');
    });

    it('resolves the metadata against the datasource of the card the metric was selected in', () => {
      mockDatasources(PROM, PROM_TWO);
      const catalog = jest.mocked(catalogModule.useMetricCatalog);

      renderRail({
        queries: [
          { refId: 'A', datasource: { uid: 'p1' } },
          { refId: 'B', datasource: { uid: 'p2' } },
        ],
        datasourceInstance: mixedInstance,
        signalExplorer: {
          left: { cards: {}, selectedMetric: { refId: 'B', metricName: 'up' } },
        },
      });

      // Card B's datasource — not `cards[0]`'s, and never the pane's Mixed ref.
      expect(catalog).toHaveBeenCalledWith({ uid: 'p2', type: 'prometheus' }, timeRange);
    });

    it('clears the selection when the block is closed', async () => {
      const store = renderRail({
        queries: [{ refId: 'A', datasource: { uid: 'p1' } }],
        signalExplorer: {
          left: { cards: {}, selectedMetric: { refId: 'A', metricName: 'up' } },
        },
      });

      await userEvent.click(screen.getByRole('button', { name: /close/i }));

      expect(store.getState().signalExplorer.left.selectedMetric).toBeUndefined();
      // Closing removes the dock rather than swapping it for a placeholder.
      expect(screen.queryByRole('heading', { name: 'up' })).not.toBeInTheDocument();
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
        signalExplorer: { left: { cards: {}, activeRefId: 'A' } },
      });
      await userEvent.click(screen.getByRole('button', { name: /expand loki/i }));

      const [prometheusCard, lokiCard] = screen.getAllByTestId('signal-explorer-datasource-card');
      expect(within(prometheusCard).getAllByTestId('signal-explorer-metric-row')).toHaveLength(2);
      expect(within(lokiCard).getByText(/nothing to browse/i)).toBeInTheDocument();
      expect(within(lokiCard).queryByTestId('signal-explorer-metric-row')).not.toBeInTheDocument();
    });

    it('badges a metric with the refIds of this datasource’s queries, and only those', () => {
      // C is a second query on the *same* Prometheus datasource as A, so its refId belongs on the
      // card. B is Loki: its LogQL mentions `up`, but `up` is not a Loki metric — a token that
      // happens to look like a Prometheus name must not badge a Loki refId onto this card.
      renderRail({
        queries: [...twoQueries, { refId: 'C', datasource: { uid: 'p1' }, expr: 'up' } as DataQuery],
        signalExplorer: { left: { cards: {}, activeRefId: 'A' } },
      });

      expect(badgesFor('up')).toEqual(['A', 'C']);
      expect(badgesFor('node_load1')).toEqual(['A']);
    });

    it('never mutates the pane queries', async () => {
      const store = renderRail({
        queries: twoQueries,
        signalExplorer: { left: { cards: {}, activeRefId: 'A' } },
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
