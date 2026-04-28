import { VizPanel, SceneGridLayout } from '@grafana/scenes';
import { type Dashboard, type Panel, type RowPanel } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';

import { isValidLibraryPanelRef, hasLibraryPanelsInV1Dashboard, getLayoutForObject } from './utils';

describe('utils', () => {
  describe('isValidLibraryPanelRef', () => {
    it('should return true for valid library panel reference', () => {
      const panel: Panel = {
        id: 1,
        title: 'Test Panel',
        type: 'graph',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        libraryPanel: {
          uid: 'lib-panel-uid',
          name: 'Library Panel Name',
        },
      };

      expect(isValidLibraryPanelRef(panel)).toBe(true);
    });

    it('should return false for panel without libraryPanel property', () => {
      const panel: Panel = {
        id: 1,
        title: 'Test Panel',
        type: 'graph',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
      };

      expect(isValidLibraryPanelRef(panel)).toBe(false);
    });

    it('should return false for panel with libraryPanel but missing uid', () => {
      const panel: Panel = {
        id: 1,
        title: 'Test Panel',
        type: 'graph',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        // @ts-expect-error - Testing invalid library panel ref without uid
        libraryPanel: {
          name: 'Library Panel Name',
        },
      };

      expect(isValidLibraryPanelRef(panel)).toBe(false);
    });

    it('should return false for panel with libraryPanel but missing name', () => {
      const panel: Panel = {
        id: 1,
        title: 'Test Panel',
        type: 'graph',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        // @ts-expect-error - Testing invalid library panel ref without name
        libraryPanel: {
          uid: 'lib-panel-uid',
        },
      };

      expect(isValidLibraryPanelRef(panel)).toBe(false);
    });

    it('should return false for panel with libraryPanel but empty uid', () => {
      const panel: Panel = {
        id: 1,
        title: 'Test Panel',
        type: 'graph',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        libraryPanel: {
          uid: '',
          name: 'Library Panel Name',
        },
      };

      expect(isValidLibraryPanelRef(panel)).toBe(false);
    });

    it('should return false for panel with libraryPanel but empty name', () => {
      const panel: Panel = {
        id: 1,
        title: 'Test Panel',
        type: 'graph',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        libraryPanel: {
          uid: 'lib-panel-uid',
          name: '',
        },
      };

      expect(isValidLibraryPanelRef(panel)).toBe(false);
    });

    it('should return false for panel with null libraryPanel', () => {
      const panel: Panel = {
        id: 1,
        title: 'Test Panel',
        type: 'graph',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        // @ts-expect-error - Testing invalid library panel ref
        libraryPanel: null,
      };

      expect(isValidLibraryPanelRef(panel)).toBe(false);
    });
  });

  describe('hasLibraryPanelsInV1Dashboard', () => {
    it('should return false for undefined dashboard', () => {
      expect(hasLibraryPanelsInV1Dashboard(undefined)).toBe(false);
    });

    it('should return false for dashboard without panels', () => {
      const dashboard: Dashboard = {
        id: 1,
        title: 'Test Dashboard',
        tags: [],
        timezone: 'browser',
        panels: [],
        time: { from: 'now-6h', to: 'now' },
        timepicker: {},
        templating: { list: [] },
        annotations: { list: [] },
        refresh: '',
        schemaVersion: 30,
        version: 1,
        links: [],
      };

      expect(hasLibraryPanelsInV1Dashboard(dashboard)).toBe(false);
    });

    it('should return false for dashboard with no library panels', () => {
      const dashboard: Dashboard = {
        id: 1,
        title: 'Test Dashboard',
        tags: [],
        timezone: 'browser',
        panels: [
          {
            id: 1,
            title: 'Regular Panel',
            type: 'graph',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
          },
        ],
        time: { from: 'now-6h', to: 'now' },
        timepicker: {},
        templating: { list: [] },
        annotations: { list: [] },
        refresh: '',
        schemaVersion: 30,
        version: 1,
        links: [],
      };

      expect(hasLibraryPanelsInV1Dashboard(dashboard)).toBe(false);
    });

    it('should return true for dashboard with library panels', () => {
      const dashboard: Dashboard = {
        id: 1,
        title: 'Test Dashboard',
        tags: [],
        timezone: 'browser',
        panels: [
          {
            id: 1,
            title: 'Library Panel',
            type: 'graph',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
            libraryPanel: {
              uid: 'lib-panel-uid',
              name: 'Library Panel Name',
            },
          },
        ],
        time: { from: 'now-6h', to: 'now' },
        timepicker: {},
        templating: { list: [] },
        annotations: { list: [] },
        refresh: '',
        schemaVersion: 30,
        version: 1,
        links: [],
      };

      expect(hasLibraryPanelsInV1Dashboard(dashboard)).toBe(true);
    });

    it('should return true for dashboard with library panels in collapsed row', () => {
      const collapsedRowPanel: RowPanel = {
        id: 1,
        title: 'Row Panel',
        type: 'row',
        gridPos: { x: 0, y: 0, w: 24, h: 1 },
        collapsed: true,
        panels: [
          {
            id: 2,
            title: 'Library Panel in Row',
            type: 'graph',
            gridPos: { x: 0, y: 1, w: 12, h: 8 },
            libraryPanel: {
              uid: 'lib-panel-uid',
              name: 'Library Panel Name',
            },
          },
        ],
      };

      const dashboard: Dashboard = {
        id: 1,
        title: 'Test Dashboard',
        tags: [],
        timezone: 'browser',
        panels: [collapsedRowPanel],
        time: { from: 'now-6h', to: 'now' },
        timepicker: {},
        templating: { list: [] },
        annotations: { list: [] },
        refresh: '',
        schemaVersion: 30,
        version: 1,
        links: [],
      };

      expect(hasLibraryPanelsInV1Dashboard(dashboard)).toBe(true);
    });

    it('should return false for dashboard with collapsed row but no library panels', () => {
      const collapsedRowPanel: RowPanel = {
        id: 1,
        title: 'Row Panel',
        type: 'row',
        gridPos: { x: 0, y: 0, w: 24, h: 1 },
        collapsed: true,
        panels: [
          {
            id: 2,
            title: 'Regular Panel in Row',
            type: 'graph',
            gridPos: { x: 0, y: 1, w: 12, h: 8 },
          },
        ],
      };

      const dashboard: Dashboard = {
        id: 1,
        title: 'Test Dashboard',
        tags: [],
        timezone: 'browser',
        panels: [collapsedRowPanel],
        time: { from: 'now-6h', to: 'now' },
        timepicker: {},
        templating: { list: [] },
        annotations: { list: [] },
        refresh: '',
        schemaVersion: 30,
        version: 1,
        links: [],
      };

      expect(hasLibraryPanelsInV1Dashboard(dashboard)).toBe(false);
    });

    it('should return false for dashboard with expanded row (not collapsed)', () => {
      const expandedRowPanel: RowPanel = {
        id: 1,
        title: 'Row Panel',
        type: 'row',
        gridPos: { x: 0, y: 0, w: 24, h: 1 },
        collapsed: false,
        panels: [
          {
            id: 2,
            title: 'Library Panel in Row',
            type: 'graph',
            gridPos: { x: 0, y: 1, w: 12, h: 8 },
            libraryPanel: {
              uid: 'lib-panel-uid',
              name: 'Library Panel Name',
            },
          },
        ],
      };

      const dashboard: Dashboard = {
        id: 1,
        title: 'Test Dashboard',
        tags: [],
        timezone: 'browser',
        panels: [expandedRowPanel],
        time: { from: 'now-6h', to: 'now' },
        timepicker: {},
        templating: { list: [] },
        annotations: { list: [] },
        refresh: '',
        schemaVersion: 30,
        version: 1,
        links: [],
      };

      expect(hasLibraryPanelsInV1Dashboard(dashboard)).toBe(false);
    });

    it('should return false for dashboard with row panel without panels property', () => {
      //@ts-expect-error - Testing invalid row panel
      const rowPanel: RowPanel = {
        id: 1,
        title: 'Row Panel',
        type: 'row',
        gridPos: { x: 0, y: 0, w: 24, h: 1 },
        collapsed: true,
      };

      const dashboard: Dashboard = {
        id: 1,
        title: 'Test Dashboard',
        tags: [],
        timezone: 'browser',
        panels: [rowPanel],
        time: { from: 'now-6h', to: 'now' },
        timepicker: {},
        templating: { list: [] },
        annotations: { list: [] },
        refresh: '',
        schemaVersion: 30,
        version: 1,
        links: [],
      };

      expect(hasLibraryPanelsInV1Dashboard(dashboard)).toBe(false);
    });

    it('should return true for dashboard with mixed panels and library panels', () => {
      const dashboard: Dashboard = {
        id: 1,
        title: 'Test Dashboard',
        tags: [],
        timezone: 'browser',
        panels: [
          {
            id: 1,
            title: 'Regular Panel',
            type: 'graph',
            gridPos: { x: 0, y: 0, w: 12, h: 8 },
          },
          {
            id: 2,
            title: 'Library Panel',
            type: 'graph',
            gridPos: { x: 12, y: 0, w: 12, h: 8 },
            libraryPanel: {
              uid: 'lib-panel-uid',
              name: 'Library Panel Name',
            },
          },
        ],
        time: { from: 'now-6h', to: 'now' },
        timepicker: {},
        templating: { list: [] },
        annotations: { list: [] },
        refresh: '',
        schemaVersion: 30,
        version: 1,
        links: [],
      };

      expect(hasLibraryPanelsInV1Dashboard(dashboard)).toBe(true);
    });
  });

  describe('getLayoutForObject', () => {
    it('returns the DefaultGridLayoutManager when given the dashboard', () => {
      const { grid: defaultGrid } = getDefaultGrid();
      const dashboard = getDashboardWithGrid(defaultGrid);

      const layout = getLayoutForObject(dashboard);

      expect(layout).toBe(defaultGrid);
      expect(layout).toBeInstanceOf(DefaultGridLayoutManager);
    });

    it('returns the AutoGridLayoutManager when given the dashboard', () => {
      const { grid: autoGrid } = getAutoGrid();
      const dashboard = getDashboardWithGrid(autoGrid);

      const layout = getLayoutForObject(dashboard);

      expect(layout).toBe(autoGrid);
      expect(layout).toBeInstanceOf(AutoGridLayoutManager);
    });

    it('when passed a RowItem, returns its layout', () => {
      const { grid } = getDefaultGrid();
      const row = new RowItem({ layout: grid });

      const layout = getLayoutForObject(row);

      expect(layout).toBe(grid);
      expect(layout).toBeInstanceOf(DefaultGridLayoutManager);
    });

    it('when passed a TabItem, returns its layout', () => {
      const { grid } = getDefaultGrid();
      const tab = new TabItem({ layout: grid });

      const layout = getLayoutForObject(tab);

      expect(layout).toBe(grid);
      expect(layout).toBeInstanceOf(DefaultGridLayoutManager);
    });

    it('when passed a DefaultGridLayoutManager, returns the DefaultGridManager', () => {
      const { grid: defaultGrid } = getDefaultGrid();
      const layout = getLayoutForObject(defaultGrid);

      expect(layout).toBe(defaultGrid);
      expect(layout).toBeInstanceOf(DefaultGridLayoutManager);
    });

    it('when passed an AutoGridLayoutManager, returns the AutoGridManager', () => {
      const { grid: autoGrid } = getAutoGrid();
      const layout = getLayoutForObject(autoGrid);

      expect(layout).toBe(autoGrid);
      expect(layout).toBeInstanceOf(AutoGridLayoutManager);
    });

    it('whe passed a panel in default grid, returns the default grid', () => {
      const { grid: defaultGrid, panel } = getDefaultGrid();

      const layout = getLayoutForObject(panel);

      expect(layout).toBe(defaultGrid);
    });

    it('when passed a panel in auto grid, returns the auto grid', () => {
      const { grid: autoGrid, panel } = getAutoGrid();

      const layout = getLayoutForObject(panel);

      expect(layout).toBe(autoGrid);
      expect(layout).toBeInstanceOf(AutoGridLayoutManager);
    });
  });
});

const getDashboardWithGrid = (grid: DefaultGridLayoutManager | AutoGridLayoutManager) =>
  new DashboardScene({ title: 'Test', uid: 'dash-1', body: grid });

const getDefaultGrid = () => {
  const panel = new VizPanel({ title: 'P', key: 'p1', pluginId: 'table' });
  const gridItem = new DashboardGridItem({ key: 'gi1', body: panel });
  const grid = new SceneGridLayout({ children: [gridItem] });
  return { grid: new DefaultGridLayoutManager({ grid }), panel };
};

const getAutoGrid = () => {
  const panel = new VizPanel({ title: 'P', key: 'p1', pluginId: 'table' });
  const autoGridItem = new AutoGridItem({ key: 'agi1', body: panel });
  return {
    grid: new AutoGridLayoutManager({
      layout: new AutoGridLayout({ children: [autoGridItem] }),
    }),
    panel,
  };
};
