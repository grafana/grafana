import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type TimeRange,
} from '@grafana/data';
import { initDataSourceInstanceSettings, setDatasourcePluginMetas } from '@grafana/runtime/internal';
import { type DataQuery } from '@grafana/schema';

import { type ContentOutlineItemContextProps } from '../ContentOutline/ContentOutlineContext';

import { SignalExplorer } from './SignalExplorer';

jest.mock('../ContentOutline/ContentOutlineContext', () => ({
  useContentOutlineContext: jest.fn(),
}));

const makeMeta = (id: string) =>
  ({
    id,
    name: id,
    type: 'datasource',
    info: { logos: { small: `${id}.svg`, large: `${id}.svg` } },
  }) as unknown as DataSourcePluginMeta;

const makeSettings = (uid: string, type: string, name: string) =>
  ({ uid, type, name, meta: makeMeta(type) }) as unknown as DataSourceInstanceSettings;

// The component resolves a card's datasource from the instance list and its logo from the
// datasource plugin metas, so both of the real caches behind those hooks are seeded here. No
// legacy `DataSourceSrv` is registered: the new APIs' fallback to it stays inert, so a seeding
// gap surfaces as an unresolved card instead of being papered over by legacy resolution.
const datasources: Record<string, DataSourceInstanceSettings> = {
  'gdev-prometheus': makeSettings('prom-uid', 'prometheus', 'gdev-prometheus'),
  'gdev-loki': makeSettings('loki-uid', 'loki', 'gdev-loki'),
  'gdev-amp': makeSettings('amp-uid', 'grafana-amazonprometheus-datasource', 'gdev-amp'),
};

const pluginMetas: Record<string, DataSourcePluginMeta> = {
  prometheus: makeMeta('prometheus'),
  loki: makeMeta('loki'),
  'grafana-amazonprometheus-datasource': makeMeta('grafana-amazonprometheus-datasource'),
};

const scrollerMock = document.createElement('div');

const promQuery = (refId: string, expr = ''): DataQuery =>
  ({ refId, datasource: { uid: 'prom-uid', type: 'prometheus' }, expr }) as DataQuery;

const timeRange = { raw: { from: 'now-1h', to: 'now' }, from: {}, to: {} } as unknown as TimeRange;

const explorer = (queries: DataQuery[], paneDatasource?: DataSourceApi) => (
  <SignalExplorer
    queries={queries}
    paneDatasource={paneDatasource}
    timeRange={timeRange}
    scroller={scrollerMock}
    toggleButton={<button type="button">Collapse outline</button>}
  />
);

const seedDataSources = () => {
  initDataSourceInstanceSettings(datasources, 'gdev-prometheus');
  setDatasourcePluginMetas(pluginMetas);
};

const setup = async (queries: DataQuery[], paneDatasource?: DataSourceApi) => {
  scrollerMock.scroll = jest.fn();
  seedDataSources();

  // Query rows register themselves as children of the Queries outline item.
  const queryChildren: ContentOutlineItemContextProps[] = queries.map((query) => ({
    id: `queries-${query.refId}`,
    panelId: 'Queries',
    title: query.refId,
    icon: 'arrow',
    level: 'child',
    customTopOffset: -10,
    ref: document.createElement('div'),
  }));

  const useContentOutlineContextMock = jest.requireMock('../ContentOutline/ContentOutlineContext')
    .useContentOutlineContext as jest.Mock;

  useContentOutlineContextMock.mockReturnValue({
    outlineItems: [
      {
        id: 'queries',
        panelId: 'Queries',
        title: 'Queries',
        icon: 'arrow',
        level: 'root',
        ref: document.createElement('div'),
        children: queryChildren,
      },
    ],
  });

  const rendered = render(explorer(queries, paneDatasource));

  // Both datasource hooks resolve a few promise turns after the first paint. Settling them here
  // keeps those state updates inside act() and means the assertions below see resolved cards.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    user: userEvent.setup(),
    ...rendered,
  };
};

describe('<SignalExplorer />', () => {
  it('renders the header with the injected toggle button', async () => {
    await setup([]);

    expect(screen.getByText('Datasource explorer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse outline' })).toBeInTheDocument();
  });

  it('renders an empty state when there are no queries', async () => {
    await setup([]);

    expect(screen.getByText('Add a query to browse its datasource.')).toBeInTheDocument();
  });

  it('renders one card per query, labelled with its own datasource in a Mixed pane', async () => {
    await setup([
      { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'loki-uid', type: 'loki' } },
    ]);

    expect(screen.getByTestId('signal-card-A')).toBeInTheDocument();
    expect(screen.getByTestId('signal-card-B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to query B (gdev-loki)' })).toBeInTheDocument();
  });

  it('resolves a query that names its datasource instead of carrying its uid', async () => {
    await setup([{ refId: 'A', datasource: { uid: 'gdev-loki', type: 'loki' } }]);

    // The name, not the 'loki' type the label falls back to when the ref resolves to nothing.
    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-loki)' })).toBeInTheDocument();
  });

  it('labels a card with its datasource type until the datasource list resolves', async () => {
    seedDataSources();
    render(explorer([{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }]));

    // The list is async, so the first paint only has the ref's own fields to label the card with.
    expect(screen.getByRole('button', { name: 'Jump to query A (prometheus)' })).toBeInTheDocument();

    expect(await screen.findByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toBeInTheDocument();
  });

  it('takes a card logo from the plugin meta of the datasource type', async () => {
    await setup([{ refId: 'A', datasource: { uid: 'loki-uid', type: 'loki' } }]);

    expect(screen.getByTestId('signal-card-A').querySelector('img')).toHaveAttribute('src', 'loki.svg');
  });

  it('falls back to the pane datasource for queries without their own ref', async () => {
    await setup([{ refId: 'A' }], { uid: 'prom-uid', type: 'prometheus' } as DataSourceApi);

    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
  });

  it('only makes Prometheus cards expandable', async () => {
    await setup([
      { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'loki-uid', type: 'loki' } },
    ]);

    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand datasource explorer for query B' })).not.toBeInTheDocument();
  });

  it('treats Prometheus flavors as expandable', async () => {
    await setup([{ refId: 'A', datasource: { uid: 'amp-uid', type: 'grafana-amazonprometheus-datasource' } }]);

    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
  });

  it('reveals the metrics explorer when a Prometheus card is expanded', async () => {
    const { user } = await setup([{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }]);
    expect(screen.queryByPlaceholderText('Search metrics')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));

    expect(screen.getByPlaceholderText('Search metrics')).toBeInTheDocument();
  });

  it('collapses a card again without affecting the others', async () => {
    const { user } = await setup([
      { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'prom-uid', type: 'prometheus' } },
    ]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));
    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query B' }));
    expect(screen.getAllByPlaceholderText('Search metrics')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Collapse datasource explorer for query A' }));

    expect(screen.getAllByPlaceholderText('Search metrics')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse datasource explorer for query B' })).toBeInTheDocument();
  });

  it('keeps multiple cards expanded independently', async () => {
    const { user } = await setup([
      { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'prom-uid', type: 'prometheus' } },
    ]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));
    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query B' }));

    expect(screen.getAllByPlaceholderText('Search metrics')).toHaveLength(2);
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(2);
  });

  it('relabels a card when its query switches datasource', async () => {
    const { rerender } = await setup([{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }]);
    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();

    rerender(explorer([{ refId: 'A', datasource: { uid: 'loki-uid', type: 'loki' } }]));

    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-loki)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand datasource explorer for query A' })).not.toBeInTheDocument();
  });

  it('keeps an expanded card intact while its query is being edited', async () => {
    const { user, rerender } = await setup([promQuery('A')]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));
    await user.type(screen.getByPlaceholderText('Search metrics'), 'node_cpu');

    // Explore replaces the queries array on every keystroke in the query editor, which
    // must not remount the cards and throw away what the user typed in the body.
    rerender(explorer([promQuery('A', 'u')]));
    rerender(explorer([promQuery('A', 'up')]));

    expect(screen.getByRole('button', { name: 'Collapse datasource explorer for query A' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search metrics')).toHaveValue('node_cpu');
  });

  it('scrolls to the query row when a card is clicked', async () => {
    const { user } = await setup([{ refId: 'A', datasource: { uid: 'loki-uid', type: 'loki' } }]);

    await user.click(screen.getByRole('button', { name: /^Jump to query A/ }));

    expect(scrollerMock.scroll).toHaveBeenCalledWith({ top: -10, behavior: 'smooth' });
  });

  it('forgets a deleted query, so a new one reusing its refId is not already expanded', async () => {
    const { user, rerender } = await setup([promQuery('A'), promQuery('B')]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query B' }));
    expect(screen.getByPlaceholderText('Search metrics')).toBeInTheDocument();

    rerender(explorer([promQuery('A')]));
    // Explore assigns the lowest unused refId, so the next query added is B again.
    rerender(explorer([promQuery('A'), promQuery('B')]));

    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query B' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search metrics')).not.toBeInTheDocument();
  });

  it('forgets an expanded card when its query moves to a datasource with no explorer', async () => {
    const { user, rerender } = await setup([promQuery('A')]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));

    rerender(explorer([{ refId: 'A', datasource: { uid: 'loki-uid', type: 'loki' } }]));
    rerender(explorer([promQuery('A')]));

    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search metrics')).not.toBeInTheDocument();
  });

  it('keeps the remaining cards expanded when another query is deleted', async () => {
    const { user, rerender } = await setup([promQuery('A'), promQuery('B'), promQuery('C')]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));
    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query C' }));

    rerender(explorer([promQuery('A'), promQuery('C')]));

    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(2);
  });

  it('does nothing when a card has no query row to scroll to', async () => {
    // The outline mock only registers rows for the queries passed to setup, so a card
    // added afterwards has nothing to scroll to.
    const { user, rerender } = await setup([]);
    rerender(explorer([{ refId: 'Z', datasource: { uid: 'loki-uid', type: 'loki' } }]));

    await user.click(screen.getByRole('button', { name: /^Jump to query Z/ }));

    expect(scrollerMock.scroll).not.toHaveBeenCalled();
  });

  it('expanding a card does not also jump to its query, since the chevron does not bubble', async () => {
    const { user } = await setup([{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));

    expect(scrollerMock.scroll).not.toHaveBeenCalled();
  });
});
