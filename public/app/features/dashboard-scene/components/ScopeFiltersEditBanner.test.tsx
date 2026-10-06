import { act, render, screen } from 'test/test-utils';

import { type Scope } from '@grafana/data';
import { useScopes } from '@grafana/runtime';
import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { hasScopeFilteredDatasource } from 'app/features/scopes/dashboards/scopeFilteredDatasources';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { ScopeFiltersEditBanner } from './ScopeFiltersEditBanner';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useScopes: jest.fn(),
}));

jest.mock('app/features/scopes/dashboards/scopeFilteredDatasources', () => ({
  ...jest.requireActual('app/features/scopes/dashboards/scopeFilteredDatasources'),
  hasScopeFilteredDatasource: jest.fn(
    jest.requireActual('app/features/scopes/dashboards/scopeFilteredDatasources').hasScopeFilteredDatasource
  ),
}));

const mockUseScopes = jest.mocked(useScopes);
const mockHasScopeFilteredDatasource = jest.mocked(hasScopeFilteredDatasource);

const BANNER_TEST_ID = 'scope-filters-edit-banner';

function makeScope(name: string, hasFilters: boolean): Scope {
  return {
    metadata: { name },
    spec: {
      title: name,
      filters: hasFilters ? [{ key: 'env', value: 'prod', operator: 'equals' }] : [],
    },
  };
}

function mockScopes(scopes: Scope[] | undefined) {
  if (scopes === undefined) {
    mockUseScopes.mockReturnValue(undefined);
    return;
  }
  mockUseScopes.mockReturnValue({
    state: { value: scopes, loading: false, enabled: true, readOnly: false, drawerOpened: false },
  } as ReturnType<typeof useScopes>);
}

function buildDashboard(opts: { isEditing: boolean; datasourceTypes: Array<string | undefined>; isNew?: boolean }) {
  const panels = opts.datasourceTypes.map(
    (type, i) =>
      new VizPanel({
        key: `panel-${i}`,
        pluginId: 'timeseries',
        title: `Panel ${i}`,
        ...(type
          ? { $data: new SceneQueryRunner({ datasource: { type, uid: `${type}-ds` }, queries: [{ refId: 'A' }] }) }
          : {}),
      })
  );

  return new DashboardScene({
    title: 'Dash',
    // A dashboard being created has no uid yet; this mirrors that.
    uid: opts.isNew ? undefined : 'dash-1',
    meta: { canEdit: true },
    isEditing: opts.isEditing,
    $timeRange: new SceneTimeRange({}),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: panels.map((panel, i) => new DashboardGridItem({ key: `grid-item-${i}`, body: panel })),
      }),
    }),
  });
}

describe('ScopeFiltersEditBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when editing, a scope with filters is selected, and a Loki panel is present', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.getByTestId(BANNER_TEST_ID)).toHaveTextContent(
      /You are editing this dashboard with a Scope selected/
    );
  });

  it('renders for a newly created dashboard in edit mode under the same conditions', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, isNew: true, datasourceTypes: ['prometheus'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.getByTestId(BANNER_TEST_ID)).toBeInTheDocument();
  });

  it('does not render in view mode (not editing)', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: false, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();
  });

  it('does not render when no scope is selected', () => {
    mockScopes([]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();
  });

  it('does not render when the scopes feature is unavailable', () => {
    mockScopes(undefined);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();
  });

  it('does not render when the selected scope has no filters', () => {
    mockScopes([makeScope('scope-1', false)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();
  });

  it('does not render when the dashboard has no Loki or Prometheus panels', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['testdata', 'mysql'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();
  });

  it('does not render for a dashboard with no panels at all', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: [] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();
  });

  it('renders once a Loki panel is added to the grid after edit mode has already started', async () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['mysql'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);
    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();

    const grid = (dashboard.state.body as DefaultGridLayoutManager).state.grid;
    const newPanel = new VizPanel({
      key: 'panel-new',
      pluginId: 'timeseries',
      title: 'New panel',
      $data: new SceneQueryRunner({ datasource: { type: 'loki', uid: 'loki-ds' }, queries: [{ refId: 'A' }] }),
    });
    act(() => {
      grid.setState({
        children: [...grid.state.children, new DashboardGridItem({ key: 'grid-item-new', body: newPanel })],
      });
    });

    expect(await screen.findByTestId(BANNER_TEST_ID)).toBeInTheDocument();
  });

  it('does not re-walk the scene for a panel data refresh, but does for a structural change', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });
    const gridItem = (dashboard.state.body as DefaultGridLayoutManager).state.grid.state
      .children[0] as DashboardGridItem;
    const panel = gridItem.state.body as VizPanel;
    const queryRunner = panel.state.$data as SceneQueryRunner;

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);
    const callsAfterMount = mockHasScopeFilteredDatasource.mock.calls.length;

    // A data refresh only ever touches `data` (and `_hasFetchedData`) on the query runner.
    act(() => {
      queryRunner.setState({ data: undefined });
    });
    expect(mockHasScopeFilteredDatasource.mock.calls.length).toBe(callsAfterMount);

    // Changing what the query actually targets is a structural change and must be picked up.
    act(() => {
      queryRunner.setState({ datasource: { type: 'mysql', uid: 'mysql-ds' } });
    });
    expect(mockHasScopeFilteredDatasource.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it('renders when at least one of several panels uses Prometheus', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['mysql', 'prometheus'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.getByTestId(BANNER_TEST_ID)).toBeInTheDocument();
  });

  it('dismisses the banner when the close button is clicked', async () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    const { user } = render(<ScopeFiltersEditBanner dashboard={dashboard} />);
    expect(screen.getByTestId(BANNER_TEST_ID)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Close alert/i }));

    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();
  });

  it('disappears when edit mode is exited, and reappears if edit mode is re-entered after a dismissal', async () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    const { user, rerender } = render(<ScopeFiltersEditBanner dashboard={dashboard} />);
    await user.click(screen.getByRole('button', { name: /Close alert/i }));
    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();

    act(() => {
      dashboard.setState({ isEditing: false });
    });
    rerender(<ScopeFiltersEditBanner dashboard={dashboard} />);
    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();

    act(() => {
      dashboard.setState({ isEditing: true });
    });
    rerender(<ScopeFiltersEditBanner dashboard={dashboard} />);
    expect(screen.getByTestId(BANNER_TEST_ID)).toBeInTheDocument();
  });

  it('does not carry a dismissal over to a different dashboard keyed by dashboard.state.key', async () => {
    // Mirrors the usage site (DashboardScenePage), which keys the banner by dashboard.state.key so
    // navigating to a different dashboard remounts it instead of reusing the dismissed state.
    mockScopes([makeScope('scope-1', true)]);
    const dashboardA = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });
    const dashboardB = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    const { user, rerender } = render(<ScopeFiltersEditBanner dashboard={dashboardA} key={dashboardA.state.key} />);
    await user.click(screen.getByRole('button', { name: /Close alert/i }));
    expect(screen.queryByTestId(BANNER_TEST_ID)).not.toBeInTheDocument();

    rerender(<ScopeFiltersEditBanner dashboard={dashboardB} key={dashboardB.state.key} />);
    expect(screen.getByTestId(BANNER_TEST_ID)).toBeInTheDocument();
  });
});
