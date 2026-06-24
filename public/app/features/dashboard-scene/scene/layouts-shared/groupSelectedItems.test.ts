import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { canGroupSelection, groupSelectedInto } from './groupSelectedItems';

let lastUndo: (() => void) | undefined;

jest.mock('../../edit-pane/shared', () => ({
  ...jest.requireActual('../../edit-pane/shared'),
  dashboardEditActions: {
    edit: jest.fn(({ perform, undo }) => {
      perform();
      lastUndo = undo;
    }),
    addElement: jest.fn(({ perform, undo }) => {
      perform();
      lastUndo = undo;
    }),
    removeElement: jest.fn(({ perform, undo }) => {
      perform();
      lastUndo = undo;
    }),
  },
}));

beforeEach(() => {
  lastUndo = undefined;
});

function buildPanel(key: string): VizPanel {
  return new VizPanel({ key, title: key, pluginId: 'timeseries' });
}

function rowTitles(layout: unknown): string[] {
  return layout instanceof RowsLayoutManager ? layout.state.rows.map((r) => r.state.title ?? '') : [];
}

function tabTitles(layout: unknown): string[] {
  return layout instanceof TabsLayoutManager ? layout.state.tabs.map((tb) => tb.state.title ?? '') : [];
}

function panelKeys(layout: unknown): string[] {
  return layout instanceof DefaultGridLayoutManager || layout instanceof AutoGridLayoutManager
    ? layout.getVizPanels().map((p) => p.state.key ?? '')
    : [];
}

describe('groupSelectedInto', () => {
  describe('rows', () => {
    function buildRowsScene() {
      const r1 = new RowItem({ title: 'R1' });
      const r2 = new RowItem({ title: 'R2' });
      const r3 = new RowItem({ title: 'R3' });
      const rows = new RowsLayoutManager({ rows: [r1, r2, r3] });
      const scene = new DashboardScene({ body: rows });
      return { scene, rows, r1, r2, r3 };
    }

    it('groups selected rows into tabs and partitions the rest into a second tab', () => {
      const { scene, r1, r3 } = buildRowsScene();

      groupSelectedInto([r1, r3], 'tab');

      const body = scene.state.body;
      expect(body).toBeInstanceOf(TabsLayoutManager);

      if (!(body instanceof TabsLayoutManager)) {
        throw new Error('expected tabs layout');
      }

      expect(body.state.tabs).toHaveLength(2);
      expect(rowTitles(body.state.tabs[0].getLayout())).toEqual(['R1', 'R3']);
      expect(rowTitles(body.state.tabs[1].getLayout())).toEqual(['R2']);

      lastUndo?.();

      const restored = scene.state.body;
      expect(restored).toBeInstanceOf(RowsLayoutManager);
      expect(rowTitles(restored)).toEqual(['R1', 'R2', 'R3']);
    });

    it('groups selected rows into a parent row and leaves the rest as siblings', () => {
      const { scene, r1, r3 } = buildRowsScene();

      groupSelectedInto([r1, r3], 'row');

      const body = scene.state.body;
      expect(body).toBeInstanceOf(RowsLayoutManager);

      if (!(body instanceof RowsLayoutManager)) {
        throw new Error('expected rows layout');
      }

      expect(body.state.rows).toHaveLength(2);
      expect(rowTitles(body.state.rows[0].getLayout())).toEqual(['R1', 'R3']);
      expect(body.state.rows[1].state.title).toBe('R2');

      lastUndo?.();

      const restored = scene.state.body;
      expect(restored).toBeInstanceOf(RowsLayoutManager);
      expect(rowTitles(restored)).toEqual(['R1', 'R2', 'R3']);
    });

    it('creates a single group when every row is selected', () => {
      const { scene, r1, r2, r3 } = buildRowsScene();

      groupSelectedInto([r1, r2, r3], 'tab');

      const body = scene.state.body;

      if (!(body instanceof TabsLayoutManager)) {
        throw new Error('expected tabs layout');
      }

      expect(body.state.tabs).toHaveLength(1);
      expect(rowTitles(body.state.tabs[0].getLayout())).toEqual(['R1', 'R2', 'R3']);
    });
  });

  describe('tabs', () => {
    it('groups selected tabs into rows (tab target is unavailable)', () => {
      const t1 = new TabItem({ title: 'T1' });
      const t2 = new TabItem({ title: 'T2' });
      const t3 = new TabItem({ title: 'T3' });
      const tabs = new TabsLayoutManager({ tabs: [t1, t2, t3] });
      const scene = new DashboardScene({ body: tabs });

      groupSelectedInto([t1, t3], 'row');

      const body = scene.state.body;
      expect(body).toBeInstanceOf(RowsLayoutManager);

      if (!(body instanceof RowsLayoutManager)) {
        throw new Error('expected rows layout');
      }

      expect(body.state.rows).toHaveLength(2);
      expect(tabTitles(body.state.rows[0].getLayout())).toEqual(['T1', 'T3']);
      expect(tabTitles(body.state.rows[1].getLayout())).toEqual(['T2']);

      lastUndo?.();

      const restored = scene.state.body;
      expect(restored).toBeInstanceOf(TabsLayoutManager);
      expect(tabTitles(restored)).toEqual(['T1', 'T2', 'T3']);
    });
  });

  describe('panels', () => {
    it('groups selected panels in a default grid into a row, partitioning the rest', () => {
      const p1 = buildPanel('panel-1');
      const p2 = buildPanel('panel-2');
      const p3 = buildPanel('panel-3');
      const grid = new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [
            new DashboardGridItem({ body: p1, x: 0, y: 0, width: 12, height: 8 }),
            new DashboardGridItem({ body: p2, x: 0, y: 8, width: 12, height: 8 }),
            new DashboardGridItem({ body: p3, x: 0, y: 16, width: 12, height: 8 }),
          ],
        }),
      });
      const scene = new DashboardScene({ body: grid });

      groupSelectedInto([p1, p3], 'row');

      const body = scene.state.body;
      expect(body).toBeInstanceOf(RowsLayoutManager);

      if (!(body instanceof RowsLayoutManager)) {
        throw new Error('expected rows layout');
      }

      expect(body.state.rows).toHaveLength(2);
      expect(panelKeys(body.state.rows[0].getLayout())).toEqual(['panel-1', 'panel-3']);
      expect(panelKeys(body.state.rows[1].getLayout())).toEqual(['panel-2']);

      lastUndo?.();

      const restored = scene.state.body;
      expect(restored).toBeInstanceOf(DefaultGridLayoutManager);
      expect(panelKeys(restored)).toEqual(['panel-1', 'panel-2', 'panel-3']);
    });

    it('groups selected panels in an auto grid into a tab, partitioning the rest', () => {
      const p1 = buildPanel('panel-1');
      const p2 = buildPanel('panel-2');
      const p3 = buildPanel('panel-3');
      const grid = new AutoGridLayoutManager({
        layout: new AutoGridLayout({
          children: [new AutoGridItem({ body: p1 }), new AutoGridItem({ body: p2 }), new AutoGridItem({ body: p3 })],
        }),
      });
      const scene = new DashboardScene({ body: grid });

      groupSelectedInto([p1, p2], 'tab');

      const body = scene.state.body;
      expect(body).toBeInstanceOf(TabsLayoutManager);

      if (!(body instanceof TabsLayoutManager)) {
        throw new Error('expected tabs layout');
      }

      expect(body.state.tabs).toHaveLength(2);
      expect(panelKeys(body.state.tabs[0].getLayout())).toEqual(['panel-1', 'panel-2']);
      expect(panelKeys(body.state.tabs[1].getLayout())).toEqual(['panel-3']);
    });
  });
});

describe('canGroupSelection', () => {
  it('disables the tab target when the rows live inside a tab (one level of tabs)', () => {
    const r1 = new RowItem({ title: 'R1' });
    const r2 = new RowItem({ title: 'R2' });
    const rows = new RowsLayoutManager({ rows: [r1, r2] });
    const tabs = new TabsLayoutManager({ tabs: [new TabItem({ title: 'T1', layout: rows })] });
    new DashboardScene({ body: tabs });

    expect(canGroupSelection([r1, r2], 'row').enabled).toBe(true);
    expect(canGroupSelection([r1, r2], 'tab').enabled).toBe(false);
  });

  it('never offers the tab target for a tabs selection', () => {
    const t1 = new TabItem({ title: 'T1' });
    const t2 = new TabItem({ title: 'T2' });
    const tabs = new TabsLayoutManager({ tabs: [t1, t2] });
    new DashboardScene({ body: tabs });

    expect(canGroupSelection([t1, t2], 'row').enabled).toBe(true);
    expect(canGroupSelection([t1, t2], 'tab').enabled).toBe(false);
  });

  it('is disabled when selected panels do not share a common container', () => {
    const p1 = buildPanel('panel-1');
    const p2 = buildPanel('panel-2');
    const gridA = new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [new DashboardGridItem({ body: p1, x: 0, y: 0, width: 12, height: 8 })] }),
    });
    const gridB = new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [new DashboardGridItem({ body: p2, x: 0, y: 0, width: 12, height: 8 })] }),
    });
    const rows = new RowsLayoutManager({
      rows: [new RowItem({ title: 'A', layout: gridA }), new RowItem({ title: 'B', layout: gridB })],
    });
    new DashboardScene({ body: rows });

    const result = canGroupSelection([p1, p2], 'row');
    expect(result.enabled).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});
