import {
  AutoGridLayoutKind,
  GridLayoutKind,
  RowsLayoutKind,
  TabsLayoutKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

export function isFloat(value: number): boolean {
  return Number.isFinite(value) && !Number.isInteger(value);
}

type Layout = GridLayoutKind | RowsLayoutKind | AutoGridLayoutKind | TabsLayoutKind;

export function searchForFloatGridItems(layout: Layout): boolean {
  switch (layout.kind) {
    case 'AutoGridLayout':
      return false;

    case 'GridLayout':
      return layout.spec.items.some(
        (gridItem) =>
          gridItem.kind === 'GridLayoutItem' &&
          (isFloat(gridItem.spec.height) ||
            isFloat(gridItem.spec.width) ||
            isFloat(gridItem.spec.x) ||
            isFloat(gridItem.spec.y))
      );

    case 'RowsLayout':
      return layout.spec.rows.some((row) => row.kind === 'RowsLayoutRow' && searchForFloatGridItems(row.spec.layout));

    case 'TabsLayout':
      return layout.spec.tabs.some((tab) => tab.kind === 'TabsLayoutTab' && searchForFloatGridItems(tab.spec.layout));

    default:
      return false;
  }
}

export function roundFloatGridItems(layout: Layout): typeof layout {
  switch (layout.kind) {
    case 'GridLayout':
      return {
        ...layout,
        spec: {
          ...layout.spec,
          items: layout.spec.items.map((item) => {
            if (item.kind !== 'GridLayoutItem') {
              return item;
            }

            return {
              ...item,
              spec: {
                ...item.spec,
                height: Math.round(item.spec.height),
                width: Math.round(item.spec.width),
                x: Math.round(item.spec.x),
                y: Math.round(item.spec.y),
              },
            };
          }),
        },
      };

    case 'RowsLayout':
      return {
        ...layout,
        spec: {
          ...layout.spec,
          rows: layout.spec.rows.map((row) => {
            if (row.kind !== 'RowsLayoutRow') {
              return row;
            }

            return {
              ...row,
              spec: {
                ...row.spec,
                layout: roundFloatGridItems(row.spec.layout),
              },
            };
          }),
        },
      };

    case 'TabsLayout':
      return {
        ...layout,
        spec: {
          ...layout.spec,
          tabs: layout.spec.tabs.map((tab) => {
            if (tab.kind !== 'TabsLayoutTab') {
              return tab;
            }

            return {
              ...tab,
              spec: {
                ...tab.spec,
                layout: roundFloatGridItems(tab.spec.layout),
              },
            };
          }),
        },
      };

    default:
      return layout;
  }
}
