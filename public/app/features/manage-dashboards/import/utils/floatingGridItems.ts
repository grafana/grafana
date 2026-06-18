import {
  type AutoGridLayoutKind,
  type GridLayoutKind,
  type NotebookLayoutKind,
  type RowsLayoutKind,
  type TabsLayoutKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

// Layouts that nest inside rows/tabs and may hold grid items to truncate.
type Layout = GridLayoutKind | RowsLayoutKind | AutoGridLayoutKind | TabsLayoutKind;
// The top-level dashboard layout additionally allows NotebookLayout, which has no
// grid coordinates and so nothing to truncate.
type DashboardLayout = Layout | NotebookLayoutKind;

function truncateGridLayouts(layout: Layout): { layout: Layout; modified: boolean } {
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
        const result = truncateGridLayouts(row.spec.layout);
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
        const result = truncateGridLayouts(tab.spec.layout);
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

export function truncateFloatGridItems(layout: DashboardLayout): { layout: DashboardLayout; modified: boolean } {
  if (layout.kind === 'NotebookLayout') {
    return { layout, modified: false };
  }
  return truncateGridLayouts(layout);
}
