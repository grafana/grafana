import {
  AutoGridLayoutKind,
  GridLayoutKind,
  RowsLayoutKind,
  TabsLayoutKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

type Layout = GridLayoutKind | RowsLayoutKind | AutoGridLayoutKind | TabsLayoutKind;

export function truncateFloatGridItems(layout: Layout): { layout: Layout; modified: boolean } {
  switch (layout.kind) {
    case 'GridLayout': {
      let modified = false;
      const items = layout.spec.items.map((item) => {
        if (item.kind !== 'GridLayoutItem') {
          return item;
        }
        const { x, y, width, height } = item.spec;
        const tx = Math.trunc(x),
          ty = Math.trunc(y),
          tw = Math.trunc(width),
          th = Math.trunc(height);
        if (tx !== x || ty !== y || tw !== width || th !== height) {
          modified = true;
          return { ...item, spec: { ...item.spec, x: tx, y: ty, width: tw, height: th } };
        }
        return item;
      });
      return { layout: modified ? { ...layout, spec: { ...layout.spec, items } } : layout, modified };
    }

    case 'RowsLayout': {
      let modified = false;
      const rows = layout.spec.rows.map((row) => {
        if (row.kind !== 'RowsLayoutRow') {
          return row;
        }
        const result = truncateFloatGridItems(row.spec.layout);
        if (result.modified) {
          modified = true;
          return { ...row, spec: { ...row.spec, layout: result.layout } };
        }
        return row;
      });
      return { layout: modified ? { ...layout, spec: { ...layout.spec, rows } } : layout, modified };
    }

    case 'TabsLayout': {
      let modified = false;
      const tabs = layout.spec.tabs.map((tab) => {
        if (tab.kind !== 'TabsLayoutTab') {
          return tab;
        }
        const result = truncateFloatGridItems(tab.spec.layout);
        if (result.modified) {
          modified = true;
          return { ...tab, spec: { ...tab.spec, layout: result.layout } };
        }
        return tab;
      });
      return { layout: modified ? { ...layout, spec: { ...layout.spec, tabs } } : layout, modified };
    }

    default:
      return { layout, modified: false };
  }
}
