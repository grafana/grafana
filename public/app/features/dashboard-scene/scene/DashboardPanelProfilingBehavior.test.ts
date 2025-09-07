// Mock getPanelPerformanceCollector
jest.mock('app/features/dashboard/services/PanelPerformanceCollector', () => ({
  getPanelPerformanceCollector: jest.fn(() => ({
    getAllPanelMetrics: jest.fn(() => []),
    clearAllPanelMetrics: jest.fn(),
  })),
}));

// Mock @grafana/scenes to include VizPanelRenderProfiler
const mockVizPanelRenderProfilerInstances: any[] = [];

class MockVizPanelRenderProfiler {
  constructor(public state: any) {
    mockVizPanelRenderProfilerInstances.push(this);
  }
}

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    behaviors: {
      ...actual.behaviors,
      VizPanelRenderProfiler: MockVizPanelRenderProfiler,
    },
  };
});

import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardPanelProfilingBehavior } from './DashboardPanelProfilingBehavior';
import { DashboardScene } from './DashboardScene';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

describe('DashboardPanelProfilingBehavior', () => {
  it('should attach profilers to all VizPanels on activation', () => {
    // Create a dashboard with panels
    const panel1 = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
    });

    const panel2 = new VizPanel({
      key: 'panel-2',
      pluginId: 'table',
    });

    const gridItem1 = new DashboardGridItem({
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: panel1,
    });

    const gridItem2 = new DashboardGridItem({
      x: 12,
      y: 0,
      width: 12,
      height: 8,
      body: panel2,
    });

    const dashboard = new DashboardScene({
      title: 'Test Dashboard',
      uid: 'test-uid',
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem1, gridItem2],
        }),
      }),
      $behaviors: [new DashboardPanelProfilingBehavior()],
    });

    // Activate the dashboard
    const deactivate = dashboard.activate();

    // Check that profilers were added to panels
    expect(panel1.state.$behaviors).toBeDefined();
    expect(panel1.state.$behaviors?.length).toBeGreaterThan(0);
    expect(panel1.state.$behaviors?.some((b) => b instanceof MockVizPanelRenderProfiler)).toBe(true);

    expect(panel2.state.$behaviors).toBeDefined();
    expect(panel2.state.$behaviors?.length).toBeGreaterThan(0);
    expect(panel2.state.$behaviors?.some((b) => b instanceof MockVizPanelRenderProfiler)).toBe(true);

    deactivate();
  });

  it('should not duplicate profilers if already present', () => {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
    });

    const gridItem = new DashboardGridItem({
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: panel,
    });

    const behavior = new DashboardPanelProfilingBehavior();
    const dashboard = new DashboardScene({
      title: 'Test Dashboard',
      uid: 'test-uid',
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem],
        }),
      }),
      $behaviors: [behavior],
    });

    // Activate the dashboard
    const deactivate = dashboard.activate();

    // Check that one profiler was added
    const profilers1 = panel.state.$behaviors?.filter((b) => b instanceof MockVizPanelRenderProfiler);
    expect(profilers1?.length).toBe(1);

    // Manually call attach profilers again to simulate a re-run
    // @ts-ignore accessing private method for testing
    behavior._attachProfilesToPanels();

    // Check that still only one profiler exists (no duplicate)
    const profilers2 = panel.state.$behaviors?.filter((b) => b instanceof MockVizPanelRenderProfiler);
    expect(profilers2?.length).toBe(1);

    deactivate();
  });

  it('should handle panels in nested structures', () => {
    const panel = new VizPanel({
      key: 'panel-nested',
      pluginId: 'stat',
    });

    const gridItem = new DashboardGridItem({
      x: 0,
      y: 0,
      width: 24,
      height: 8,
      body: panel,
    });

    const dashboard = new DashboardScene({
      title: 'Test Dashboard',
      uid: 'test-uid',
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem],
        }),
      }),
      $behaviors: [new DashboardPanelProfilingBehavior()],
    });

    // Activate the dashboard
    const deactivate = dashboard.activate();

    // Check that profiler was added to nested panel
    expect(panel.state.$behaviors).toBeDefined();
    expect(panel.state.$behaviors?.some((b) => b instanceof MockVizPanelRenderProfiler)).toBe(true);

    deactivate();
  });
});
