import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceApi, type DataSourceInstanceSettings, type TimeRange } from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { type ContentOutlineItemContextProps } from '../ContentOutline/ContentOutlineContext';

import { SignalExplorer } from './SignalExplorer';

jest.mock('../ContentOutline/ContentOutlineContext', () => ({
  useContentOutlineContext: jest.fn(),
}));

const makeSettings = (uid: string, type: string, name: string) =>
  ({
    uid,
    type,
    name,
    meta: { id: type, info: { logos: { small: `${type}.svg` } } },
  }) as unknown as DataSourceInstanceSettings;

const datasources: Record<string, DataSourceInstanceSettings> = {
  'prom-uid': makeSettings('prom-uid', 'prometheus', 'gdev-prometheus'),
  'loki-uid': makeSettings('loki-uid', 'loki', 'gdev-loki'),
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

const setup = (queries: DataQuery[], paneDatasource?: DataSourceApi) => {
  scrollerMock.scroll = jest.fn();

  setDataSourceSrv({
    getInstanceSettings(ref?: string | { uid?: string }) {
      const uid = typeof ref === 'string' ? ref : ref?.uid;
      return uid ? datasources[uid] : undefined;
    },
  } as unknown as DataSourceSrv);

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

  return {
    user: userEvent.setup(),
    ...render(explorer(queries, paneDatasource)),
  };
};

describe('<SignalExplorer />', () => {
  it('renders the header with the injected toggle button', () => {
    setup([]);

    expect(screen.getByText('Datasource explorer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse outline' })).toBeInTheDocument();
  });

  it('renders an empty state when there are no queries', () => {
    setup([]);

    expect(screen.getByText('Add a query to browse its datasource.')).toBeInTheDocument();
  });

  it('renders one card per query, labelled with its own datasource in a Mixed pane', () => {
    setup([
      { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'loki-uid', type: 'loki' } },
    ]);

    expect(screen.getByTestId('signal-card-A')).toBeInTheDocument();
    expect(screen.getByTestId('signal-card-B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump to query B (gdev-loki)' })).toBeInTheDocument();
  });

  it('falls back to the pane datasource for queries without their own ref', () => {
    setup([{ refId: 'A' }], { uid: 'prom-uid', type: 'prometheus' } as DataSourceApi);

    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-prometheus)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
  });

  it('only makes Prometheus cards expandable', () => {
    setup([
      { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'loki-uid', type: 'loki' } },
    ]);

    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand datasource explorer for query B' })).not.toBeInTheDocument();
  });

  it('treats Prometheus flavors as expandable', () => {
    setup([{ refId: 'A', datasource: { uid: 'amp-uid', type: 'grafana-amazonprometheus-datasource' } }]);

    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
  });

  it('reveals the metrics explorer when a Prometheus card is expanded', async () => {
    const { user } = setup([{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }]);
    expect(screen.queryByPlaceholderText('Search metrics')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));

    expect(screen.getByPlaceholderText('Search metrics')).toBeInTheDocument();
  });

  it('collapses a card again without affecting the others', async () => {
    const { user } = setup([
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
    const { user } = setup([
      { refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'prom-uid', type: 'prometheus' } },
    ]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));
    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query B' }));

    expect(screen.getAllByPlaceholderText('Search metrics')).toHaveLength(2);
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(2);
  });

  it('relabels a card when its query switches datasource', () => {
    const { rerender } = setup([{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }]);
    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();

    rerender(explorer([{ refId: 'A', datasource: { uid: 'loki-uid', type: 'loki' } }]));

    expect(screen.getByRole('button', { name: 'Jump to query A (gdev-loki)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand datasource explorer for query A' })).not.toBeInTheDocument();
  });

  it('keeps an expanded card intact while its query is being edited', async () => {
    const { user, rerender } = setup([promQuery('A')]);

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
    const { user } = setup([{ refId: 'A', datasource: { uid: 'loki-uid', type: 'loki' } }]);

    await user.click(screen.getByRole('button', { name: /^Jump to query A/ }));

    expect(scrollerMock.scroll).toHaveBeenCalledWith({ top: -10, behavior: 'smooth' });
  });

  it('forgets a deleted query, so a new one reusing its refId is not already expanded', async () => {
    const { user, rerender } = setup([promQuery('A'), promQuery('B')]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query B' }));
    expect(screen.getByPlaceholderText('Search metrics')).toBeInTheDocument();

    rerender(explorer([promQuery('A')]));
    // Explore assigns the lowest unused refId, so the next query added is B again.
    rerender(explorer([promQuery('A'), promQuery('B')]));

    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query B' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search metrics')).not.toBeInTheDocument();
  });

  it('forgets an expanded card when its query moves to a datasource with no explorer', async () => {
    const { user, rerender } = setup([promQuery('A')]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));

    rerender(explorer([{ refId: 'A', datasource: { uid: 'loki-uid', type: 'loki' } }]));
    rerender(explorer([promQuery('A')]));

    expect(screen.getByRole('button', { name: 'Expand datasource explorer for query A' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search metrics')).not.toBeInTheDocument();
  });

  it('keeps the remaining cards expanded when another query is deleted', async () => {
    const { user, rerender } = setup([promQuery('A'), promQuery('B'), promQuery('C')]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));
    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query C' }));

    rerender(explorer([promQuery('A'), promQuery('C')]));

    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(2);
  });

  it('does nothing when a card has no query row to scroll to', async () => {
    // The outline mock only registers rows for the queries passed to setup, so a card
    // added afterwards has nothing to scroll to.
    const { user, rerender } = setup([]);
    rerender(explorer([{ refId: 'Z', datasource: { uid: 'loki-uid', type: 'loki' } }]));

    await user.click(screen.getByRole('button', { name: /^Jump to query Z/ }));

    expect(scrollerMock.scroll).not.toHaveBeenCalled();
  });

  it('expanding a card does not also jump to its query, since the chevron does not bubble', async () => {
    const { user } = setup([{ refId: 'A', datasource: { uid: 'prom-uid', type: 'prometheus' } }]);

    await user.click(screen.getByRole('button', { name: 'Expand datasource explorer for query A' }));

    expect(scrollerMock.scroll).not.toHaveBeenCalled();
  });
});
