import { buildVizAndDataPaneGrid, getDefaultSidebarRatio } from './hooks';

jest.mock('./constants', () => ({
  SidebarSize: { Mini: 'mini', Full: 'full' },
  QUERY_EDITOR_SIDEBAR_SIZE_KEY: 'grafana.dashboard.query-editor-next.sidebar-size',
}));
jest.mock('../../edit-pane/shared', () => ({ useEditPaneCollapsed: jest.fn() }));
jest.mock('../../utils/utils', () => ({ getDashboardSceneFor: jest.fn() }));
jest.mock('../PanelEditor', () => ({}));

describe('buildVizAndDataPaneGrid', () => {
  const base = {
    controlsEnabled: false,
    hasDataPane: true,
    isSidebarFullWidth: false,
    vizRatio: 0.5,
    sidebarRatio: 0.25,
  };

  it('produces only a viz row when there is no data pane', () => {
    const { gridTemplateAreas } = buildVizAndDataPaneGrid({ ...base, hasDataPane: false });

    expect(gridTemplateAreas).toBe('"viz viz"');
  });

  it('places the controls row above the viz when controls are enabled', () => {
    const { gridTemplateAreas, gridTemplateRows } = buildVizAndDataPaneGrid({ ...base, controlsEnabled: true });

    expect(gridTemplateAreas).toBe('"controls controls"\n"viz viz"\n"sidebar data-pane"');
    expect(gridTemplateRows).toBe('auto 1fr 1fr');
  });

  it('makes sidebar span every row when isSidebarFullWidth is true', () => {
    const { gridTemplateAreas } = buildVizAndDataPaneGrid({ ...base, controlsEnabled: true, isSidebarFullWidth: true });

    expect(gridTemplateAreas).toBe('"sidebar controls"\n"sidebar viz"\n"sidebar data-pane"');
  });

  it('converts vizRatio to fractional row height — ratio / (1 - ratio)', () => {
    // 0.5 → 1fr (equal split), 0.75 → 3fr (3x taller than data pane)
    expect(buildVizAndDataPaneGrid({ ...base, vizRatio: 0.5 }).gridTemplateRows).toBe('1fr 1fr');
    expect(buildVizAndDataPaneGrid({ ...base, vizRatio: 0.75 }).gridTemplateRows).toBe('3fr 1fr');
  });

  it('converts sidebarRatio 0.5 to equal columns (1fr 1fr)', () => {
    expect(buildVizAndDataPaneGrid({ ...base, sidebarRatio: 0.5 }).gridTemplateColumns).toBe('1fr 1fr');
  });

  it('converts sidebarRatio 0.25 to approximately one-third of the available width', () => {
    // 0.25 / (1 - 0.25) = 0.333...fr
    const [sidebarFr] = buildVizAndDataPaneGrid({ ...base, sidebarRatio: 0.25 }).gridTemplateColumns.split(' ');
    expect(parseFloat(sidebarFr)).toBeCloseTo(1 / 3, 5);
  });
});

describe('getDefaultSidebarRatio', () => {
  it.each([
    [2200, 0.15, 'returns a narrow sidebar at the large-monitor threshold (≥ 2200px)'],
    [2199, 0.2, 'returns a wider sidebar just below the large-monitor threshold (< 2200px)'],
    [1800, 0.2, 'returns the medium sidebar at the FHD threshold (≥ 1800px)'],
    [1799, 0.25, 'returns the default sidebar just below the FHD threshold (< 1800px)'],
  ])('%s', (width, expected) => {
    expect(getDefaultSidebarRatio(width)).toBe(expected);
  });
});
