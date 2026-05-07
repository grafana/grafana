import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { resolveLayoutPath, resolveParentPath } from './layoutPathResolver';

function buildGridLayout(): DefaultGridLayoutManager {
  return DefaultGridLayoutManager.fromVizPanels([]);
}

function buildRowsLayout(rowCount: number): RowsLayoutManager {
  const rows = Array.from({ length: rowCount }, () => new RowItem({ layout: buildGridLayout() }));
  return new RowsLayoutManager({ rows });
}

function buildTabsLayout(tabCount: number): TabsLayoutManager {
  const tabs = Array.from({ length: tabCount }, () => new TabItem({ layout: buildGridLayout() }));
  return new TabsLayoutManager({ tabs });
}

describe('resolveLayoutPath', () => {
  describe('root path "/"', () => {
    it('returns the root body', () => {
      const body = buildRowsLayout(2);
      const result = resolveLayoutPath(body, '/');

      expect(result.layoutManager).toBe(body);
      expect(result.item).toBeUndefined();
      expect(result.index).toBeUndefined();
    });
  });

  describe('single-level row paths', () => {
    it('resolves /rows/0 to the first row', () => {
      const body = buildRowsLayout(3);
      const result = resolveLayoutPath(body, '/rows/0');

      expect(result.item).toBe(body.state.rows[0]);
      expect(result.index).toBe(0);
      expect(result.layoutManager).toBe(body.state.rows[0].state.layout);
    });

    it('resolves /rows/2 to the third row', () => {
      const body = buildRowsLayout(3);
      const result = resolveLayoutPath(body, '/rows/2');

      expect(result.item).toBe(body.state.rows[2]);
      expect(result.index).toBe(2);
    });
  });

  describe('single-level tab paths', () => {
    it('resolves /tabs/0 to the first tab', () => {
      const body = buildTabsLayout(2);
      const result = resolveLayoutPath(body, '/tabs/0');

      expect(result.item).toBe(body.state.tabs[0]);
      expect(result.index).toBe(0);
      expect(result.layoutManager).toBe(body.state.tabs[0].state.layout);
    });

    it('resolves /tabs/1 to the second tab', () => {
      const body = buildTabsLayout(2);
      const result = resolveLayoutPath(body, '/tabs/1');

      expect(result.item).toBe(body.state.tabs[1]);
      expect(result.index).toBe(1);
    });
  });

  describe('nested paths', () => {
    it('resolves /tabs/0/rows/1 (rows inside a tab)', () => {
      const innerRows = buildRowsLayout(3);
      const tabs = [new TabItem({ layout: innerRows }), new TabItem({ layout: buildGridLayout() })];
      const body = new TabsLayoutManager({ tabs });

      const result = resolveLayoutPath(body, '/tabs/0/rows/1');

      expect(result.item).toBe(innerRows.state.rows[1]);
      expect(result.index).toBe(1);
      expect(result.layoutManager).toBe(innerRows.state.rows[1].state.layout);
    });

    it('resolves /rows/1/tabs/0 (tabs inside a row)', () => {
      const innerTabs = buildTabsLayout(2);
      const rows = [new RowItem({ layout: buildGridLayout() }), new RowItem({ layout: innerTabs })];
      const body = new RowsLayoutManager({ rows });

      const result = resolveLayoutPath(body, '/rows/1/tabs/0');

      expect(result.item).toBe(innerTabs.state.tabs[0]);
      expect(result.index).toBe(0);
      expect(result.layoutManager).toBe(innerTabs.state.tabs[0].state.layout);
    });
  });

  describe('error cases', () => {
    it('throws on out-of-bounds row index', () => {
      const body = buildRowsLayout(2);

      expect(() => resolveLayoutPath(body, '/rows/5')).toThrow(/out of bounds.*5.*2 rows/);
    });

    it('throws on out-of-bounds tab index', () => {
      const body = buildTabsLayout(1);

      expect(() => resolveLayoutPath(body, '/tabs/3')).toThrow(/out of bounds.*3.*1 tabs/);
    });

    it('throws when expecting RowsLayout but finding another type', () => {
      const body = buildGridLayout();

      expect(() => resolveLayoutPath(body, '/rows/0')).toThrow(/expected RowsLayoutManager/);
    });

    it('throws when expecting TabsLayout but finding another type', () => {
      const body = buildGridLayout();

      expect(() => resolveLayoutPath(body, '/tabs/0')).toThrow(/expected TabsLayoutManager/);
    });

    it('throws on malformed path (odd number of segments)', () => {
      const body = buildRowsLayout(1);

      expect(() => resolveLayoutPath(body, '/rows')).toThrow(/expected.*type\/index pairs/);
    });

    it('throws on unknown segment type', () => {
      const body = buildRowsLayout(1);

      expect(() => resolveLayoutPath(body, '/grids/0')).toThrow(/unknown segment type "grids"/);
    });

    it('throws on negative index', () => {
      const body = buildRowsLayout(1);

      expect(() => resolveLayoutPath(body, '/rows/-1')).toThrow(/invalid index/);
    });
  });
});

describe('resolveParentPath', () => {
  it('returns root body as parent for /rows/0', () => {
    const body = buildRowsLayout(2);
    const result = resolveParentPath(body, '/rows/0');

    expect(result.parent).toBe(body);
    expect(result.segment).toEqual({ type: 'rows', index: 0 });
  });

  it('returns nested layout as parent for /tabs/0/rows/1', () => {
    const innerRows = buildRowsLayout(3);
    const tabs = [new TabItem({ layout: innerRows })];
    const body = new TabsLayoutManager({ tabs });

    const result = resolveParentPath(body, '/tabs/0/rows/1');

    expect(result.parent).toBe(innerRows);
    expect(result.segment).toEqual({ type: 'rows', index: 1 });
  });

  it('throws for root path "/"', () => {
    const body = buildRowsLayout(1);

    expect(() => resolveParentPath(body, '/')).toThrow(/Cannot resolve parent of root/);
  });
});
