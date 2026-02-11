import {
  GridLayoutKind,
  RowsLayoutKind,
  TabsLayoutKind,
  defaultGridLayoutKind,
  defaultRowsLayoutKind,
  defaultTabsLayoutKind,
  defaultAutoGridLayoutKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { truncateFloatGridItems } from './floatingGridItems';

describe('truncateFloatGridItems', () => {
  describe('AutoGridLayout', () => {
    it('returns unchanged with modified=false', () => {
      const layout = defaultAutoGridLayoutKind();
      const result = truncateFloatGridItems(layout);
      expect(result.layout).toBe(layout);
      expect(result.modified).toBe(false);
    });
  });

  describe('GridLayout', () => {
    it('returns modified=false when all values are integers', () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'panel-1' }, x: 0, y: 0, width: 12, height: 8 },
        },
      ];
      const result = truncateFloatGridItems(layout);
      expect(result.modified).toBe(false);
      expect(result.layout).toBe(layout);
    });

    it('truncates float values toward zero', () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'panel-1' }, x: 1.7, y: 2.3, width: 12.8, height: 8.9 },
        },
      ];
      const result = truncateFloatGridItems(layout);
      expect(result.modified).toBe(true);
      const items = (result.layout as GridLayoutKind).spec.items;
      expect(items[0].spec).toMatchObject({ x: 1, y: 2, width: 12, height: 8 });
    });

    it('handles mixed integer and float values', () => {
      const layout = defaultGridLayoutKind();
      layout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'panel-1' }, x: 0, y: 0, width: 12, height: 8 },
        },
        {
          kind: 'GridLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'panel-2' }, x: 12.5, y: 0, width: 12, height: 8 },
        },
      ];
      const result = truncateFloatGridItems(layout);
      expect(result.modified).toBe(true);
      const items = (result.layout as GridLayoutKind).spec.items;
      expect(items[0].spec.x).toBe(0);
      expect(items[1].spec.x).toBe(12);
    });
  });

  describe('RowsLayout', () => {
    it('recursively truncates nested grid layouts', () => {
      const gridLayout = defaultGridLayoutKind();
      gridLayout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'panel-1' }, x: 1.5, y: 2.7, width: 12, height: 8 },
        },
      ];
      const layout = defaultRowsLayoutKind();
      layout.spec.rows = [{ kind: 'RowsLayoutRow', spec: { title: 'Row 1', layout: gridLayout } }];

      const result = truncateFloatGridItems(layout);
      expect(result.modified).toBe(true);
      const nestedGrid = (result.layout as RowsLayoutKind).spec.rows[0].spec.layout as GridLayoutKind;
      expect(nestedGrid.spec.items[0].spec).toMatchObject({ x: 1, y: 2 });
    });
  });

  describe('TabsLayout', () => {
    it('recursively truncates nested grid layouts', () => {
      const gridLayout = defaultGridLayoutKind();
      gridLayout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'panel-1' }, x: 0.9, y: 1.1, width: 12, height: 8 },
        },
      ];
      const layout = defaultTabsLayoutKind();
      layout.spec.tabs = [{ kind: 'TabsLayoutTab', spec: { title: 'Tab 1', layout: gridLayout } }];

      const result = truncateFloatGridItems(layout);
      expect(result.modified).toBe(true);
      const nestedGrid = (result.layout as TabsLayoutKind).spec.tabs[0].spec.layout as GridLayoutKind;
      expect(nestedGrid.spec.items[0].spec).toMatchObject({ x: 0, y: 1 });
    });
  });

  describe('deeply nested', () => {
    it('handles TabsLayout > RowsLayout > GridLayout', () => {
      const gridLayout = defaultGridLayoutKind();
      gridLayout.spec.items = [
        {
          kind: 'GridLayoutItem',
          spec: { element: { kind: 'ElementReference', name: 'panel-1' }, x: 1.9, y: 2.1, width: 12, height: 8 },
        },
      ];
      const rowsLayout = defaultRowsLayoutKind();
      rowsLayout.spec.rows = [{ kind: 'RowsLayoutRow', spec: { title: 'Row 1', layout: gridLayout } }];
      const tabsLayout = defaultTabsLayoutKind();
      tabsLayout.spec.tabs = [{ kind: 'TabsLayoutTab', spec: { title: 'Tab 1', layout: rowsLayout } }];

      const result = truncateFloatGridItems(tabsLayout);
      expect(result.modified).toBe(true);

      const tabs = result.layout as TabsLayoutKind;
      const rows = tabs.spec.tabs[0].spec.layout as RowsLayoutKind;
      const grid = rows.spec.rows[0].spec.layout as GridLayoutKind;
      expect(grid.spec.items[0].spec).toMatchObject({ x: 1, y: 2 });
    });
  });
});
