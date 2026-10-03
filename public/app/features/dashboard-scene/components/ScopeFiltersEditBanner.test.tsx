import { act, render, screen } from 'test/test-utils';

import { type Scope } from '@grafana/data';
import { useScopes } from '@grafana/runtime';
import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { ScopeFiltersEditBanner } from './ScopeFiltersEditBanner';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useScopes: jest.fn(),
}));

const mockUseScopes = jest.mocked(useScopes);

const BANNER_TEXT = /You are editing this dashboard with a Scope selected/;

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

    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it('renders for a newly created dashboard in edit mode under the same conditions', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, isNew: true, datasourceTypes: ['prometheus'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it('does not render in view mode (not editing)', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: false, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('does not render when no scope is selected', () => {
    mockScopes([]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('does not render when the scopes feature is unavailable', () => {
    mockScopes(undefined);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('does not render when the selected scope has no filters', () => {
    mockScopes([makeScope('scope-1', false)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('does not render when the dashboard has no Loki or Prometheus panels', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['testdata', 'mysql'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('does not render for a dashboard with no panels at all', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: [] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('renders when at least one of several panels uses Prometheus', () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['mysql', 'prometheus'] });

    render(<ScopeFiltersEditBanner dashboard={dashboard} />);

    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });

  it('dismisses the banner when the close button is clicked', async () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    const { user } = render(<ScopeFiltersEditBanner dashboard={dashboard} />);
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Close alert/i }));

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it('disappears when edit mode is exited, and reappears if edit mode is re-entered after a dismissal', async () => {
    mockScopes([makeScope('scope-1', true)]);
    const dashboard = buildDashboard({ isEditing: true, datasourceTypes: ['loki'] });

    const { user, rerender } = render(<ScopeFiltersEditBanner dashboard={dashboard} />);
    await user.click(screen.getByRole('button', { name: /Close alert/i }));
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();

    act(() => {
      dashboard.setState({ isEditing: false });
    });
    rerender(<ScopeFiltersEditBanner dashboard={dashboard} />);
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();

    act(() => {
      dashboard.setState({ isEditing: true });
    });
    rerender(<ScopeFiltersEditBanner dashboard={dashboard} />);
    expect(screen.getByText(BANNER_TEXT)).toBeInTheDocument();
  });
});
