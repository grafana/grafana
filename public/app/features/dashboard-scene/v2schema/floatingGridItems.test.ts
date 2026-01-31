import {
  GridLayoutKind,
  RowsLayoutKind,
  TabsLayoutKind,
  defaultGridLayoutKind,
  defaultRowsLayoutKind,
  defaultTabsLayoutKind,
  defaultAutoGridLayoutKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { isFloat, searchForFloatGridItems, roundFloatGridItems } from './floatingGridItems';

describe('floatingGridItems', () => {
  describe('isFloat', () => {
    it.each([
      { value: 1.5, expected: true, desc: 'positive float' },
      { value: -2.3, expected: true, desc: 'negative float' },
      { value: 0.1, expected: true, desc: 'small positive float' },
      { value: -0.1, expected: true, desc: 'small negative float' },
      { value: 1, expected: false, desc: 'positive integer' },
      { value: 0, expected: false, desc: 'zero' },
      { value: -1, expected: false, desc: 'negative integer' },
      { value: Infinity, expected: false, desc: 'Infinity' },
      { value: -Infinity, expected: false, desc: '-Infinity' },
      { value: NaN, expected: false, desc: 'NaN' },
    ])('returns $expected for $desc ($value)', ({ value, expected }) => {
      expect(isFloat(value)).toBe(expected);
    });
  });

  describe('searchForFloatGridItems', () => {
    describe('AutoGridLayout', () => {
      it('returns false for AutoGridLayout', () => {
        const layout = defaultAutoGridLayoutKind();
        expect(searchForFloatGridItems(layout)).toBe(false);
      });
    });

    describe('GridLayout', () => {
      it('returns false when all grid items have integer dimensions', () => {
        const layout = defaultGridLayoutKind();
        layout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 0,
              y: 0,
              width: 12,
              height: 8,
            },
          },
        ];

        expect(searchForFloatGridItems(layout)).toBe(false);
      });

      it.each([
        { prop: 'x', value: 1.5, desc: 'x is a float' },
        { prop: 'y', value: 2.3, desc: 'y is a float' },
        { prop: 'width', value: 12.7, desc: 'width is a float' },
        { prop: 'height', value: 8.2, desc: 'height is a float' },
      ])('returns true when $desc', ({ prop, value }) => {
        const layout = defaultGridLayoutKind();
        layout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: prop === 'x' ? value : 0,
              y: prop === 'y' ? value : 0,
              width: prop === 'width' ? value : 12,
              height: prop === 'height' ? value : 8,
            },
          },
        ];

        expect(searchForFloatGridItems(layout)).toBe(true);
      });

      it('returns true when at least one item has float dimensions', () => {
        const layout = defaultGridLayoutKind();
        layout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 0,
              y: 0,
              width: 12,
              height: 8,
            },
          },
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-2' },
              x: 12.5,
              y: 0,
              width: 12,
              height: 8,
            },
          },
        ];

        expect(searchForFloatGridItems(layout)).toBe(true);
      });
    });

    describe('RowsLayout', () => {
      it('returns false when all nested grid items have integer dimensions', () => {
        const gridLayout = defaultGridLayoutKind();
        gridLayout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 0,
              y: 0,
              width: 12,
              height: 8,
            },
          },
        ];

        const layout = defaultRowsLayoutKind();
        layout.spec.rows = [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              layout: gridLayout,
            },
          },
        ];

        expect(searchForFloatGridItems(layout)).toBe(false);
      });

      it('returns true when nested grid items have float dimensions', () => {
        const gridLayout = defaultGridLayoutKind();
        gridLayout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 0.5,
              y: 0,
              width: 12,
              height: 8,
            },
          },
        ];

        const layout = defaultRowsLayoutKind();
        layout.spec.rows = [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              layout: gridLayout,
            },
          },
        ];

        expect(searchForFloatGridItems(layout)).toBe(true);
      });
    });

    describe('TabsLayout', () => {
      it('returns false when all nested grid items have integer dimensions', () => {
        const gridLayout = defaultGridLayoutKind();
        gridLayout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 0,
              y: 0,
              width: 12,
              height: 8,
            },
          },
        ];

        const layout = defaultTabsLayoutKind();
        layout.spec.tabs = [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Tab 1',
              layout: gridLayout,
            },
          },
        ];

        expect(searchForFloatGridItems(layout)).toBe(false);
      });

      it('returns true when nested grid items have float dimensions', () => {
        const gridLayout = defaultGridLayoutKind();
        gridLayout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 0,
              y: 1.2,
              width: 12,
              height: 8,
            },
          },
        ];

        const layout = defaultTabsLayoutKind();
        layout.spec.tabs = [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Tab 1',
              layout: gridLayout,
            },
          },
        ];

        expect(searchForFloatGridItems(layout)).toBe(true);
      });
    });
  });

  describe('roundFloatGridItems', () => {
    describe('GridLayout', () => {
      it('rounds all float dimensions to nearest integer', () => {
        const layout = defaultGridLayoutKind();
        layout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 1.7,
              y: 2.3,
              width: 12.8,
              height: 8.2,
            },
          },
        ];

        const result = roundFloatGridItems(layout) as GridLayoutKind;
        expect(result.spec.items[0].spec.x).toBe(2);
        expect(result.spec.items[0].spec.y).toBe(2);
        expect(result.spec.items[0].spec.width).toBe(13);
        expect(result.spec.items[0].spec.height).toBe(8);
      });

      it('preserves integer dimensions', () => {
        const layout = defaultGridLayoutKind();
        layout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 0,
              y: 0,
              width: 12,
              height: 8,
            },
          },
        ];

        const result = roundFloatGridItems(layout) as GridLayoutKind;
        expect(result.spec.items[0].spec.x).toBe(0);
        expect(result.spec.items[0].spec.y).toBe(0);
        expect(result.spec.items[0].spec.width).toBe(12);
        expect(result.spec.items[0].spec.height).toBe(8);
      });

      it('processes multiple items', () => {
        const layout = defaultGridLayoutKind();
        layout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 1.4,
              y: 0.6,
              width: 12.3,
              height: 8.9,
            },
          },
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-2' },
              x: 13.7,
              y: 0.2,
              width: 11.5,
              height: 7.8,
            },
          },
        ];

        const result = roundFloatGridItems(layout) as GridLayoutKind;
        expect(result.spec.items[0].spec.x).toBe(1);
        expect(result.spec.items[0].spec.y).toBe(1);
        expect(result.spec.items[0].spec.width).toBe(12);
        expect(result.spec.items[0].spec.height).toBe(9);
        expect(result.spec.items[1].spec.x).toBe(14);
        expect(result.spec.items[1].spec.y).toBe(0);
        expect(result.spec.items[1].spec.width).toBe(12);
        expect(result.spec.items[1].spec.height).toBe(8);
      });
    });

    describe('RowsLayout', () => {
      it('rounds float dimensions in nested grid layouts', () => {
        const gridLayout = defaultGridLayoutKind();
        gridLayout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 1.5,
              y: 2.7,
              width: 12.3,
              height: 8.9,
            },
          },
        ];

        const layout = defaultRowsLayoutKind();
        layout.spec.rows = [
          {
            kind: 'RowsLayoutRow',
            spec: {
              title: 'Row 1',
              layout: gridLayout,
            },
          },
        ];

        const result = roundFloatGridItems(layout) as RowsLayoutKind;
        const resultGridLayout = result.spec.rows[0].spec.layout as GridLayoutKind;
        expect(resultGridLayout.spec.items[0].spec.x).toBe(2);
        expect(resultGridLayout.spec.items[0].spec.y).toBe(3);
        expect(resultGridLayout.spec.items[0].spec.width).toBe(12);
        expect(resultGridLayout.spec.items[0].spec.height).toBe(9);
      });
    });

    describe('TabsLayout', () => {
      it('rounds float dimensions in nested grid layouts', () => {
        const gridLayout = defaultGridLayoutKind();
        gridLayout.spec.items = [
          {
            kind: 'GridLayoutItem',
            spec: {
              element: { kind: 'ElementReference', name: 'panel-1' },
              x: 0.4,
              y: 1.8,
              width: 11.6,
              height: 7.3,
            },
          },
        ];

        const layout = defaultTabsLayoutKind();
        layout.spec.tabs = [
          {
            kind: 'TabsLayoutTab',
            spec: {
              title: 'Tab 1',
              layout: gridLayout,
            },
          },
        ];

        const result = roundFloatGridItems(layout) as TabsLayoutKind;
        const resultGridLayout = result.spec.tabs[0].spec.layout as GridLayoutKind;
        expect(resultGridLayout.spec.items[0].spec.x).toBe(0);
        expect(resultGridLayout.spec.items[0].spec.y).toBe(2);
        expect(resultGridLayout.spec.items[0].spec.width).toBe(12);
        expect(resultGridLayout.spec.items[0].spec.height).toBe(7);
      });
    });

    describe('AutoGridLayout', () => {
      it('returns layout unchanged', () => {
        const layout = defaultAutoGridLayoutKind();
        const result = roundFloatGridItems(layout);
        expect(result).toEqual(layout);
      });
    });
  });
});
