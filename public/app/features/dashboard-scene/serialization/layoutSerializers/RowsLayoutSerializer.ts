import { Spec as DashboardV2Spec, RowsLayoutRowKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';

import { layoutDeserializerRegistry } from './layoutSerializerRegistry';
import { getConditionalRendering } from './utils';

export function serializeRowsLayout(layoutManager: RowsLayoutManager): DashboardV2Spec['layout'] {
  return {
    kind: 'RowsLayout',
    spec: {
      rows: layoutManager.state.rows.filter((row) => !row.state.repeatSourceKey).map(serializeRow),
    },
  };
}

export function serializeRow(row: RowItem): RowsLayoutRowKind {
  const layout = row.state.layout.serialize();

  // Normalize Y coordinates to be relative within the row
  // Panels in the scene have absolute Y coordinates, but in V2 schema they should be relative to the row
  if (layout.kind === 'GridLayout' && layout.spec.items.length > 0) {
    // Find the minimum Y coordinate among all items in this row
    const minY = Math.min(...layout.spec.items.map((item) => item.spec.y));

    // Subtract minY from each item's Y to make coordinates relative to the row start
    layout.spec.items = layout.spec.items.map((item) => ({
      ...item,
      spec: {
        ...item.spec,
        y: item.spec.y - minY,
      },
    }));
  }

  const rowKind: RowsLayoutRowKind = {
    kind: 'RowsLayoutRow',
    spec: {
      title: row.state.title,
      collapse: row.state.collapse ?? false,
      layout: layout,
      fillScreen: row.state.fillScreen,
      hideHeader: row.state.hideHeader,
      ...(row.state.repeatByVariable && {
        repeat: {
          mode: 'variable',
          value: row.state.repeatByVariable,
        },
      }),
    },
  };

  const conditionalRenderingRootGroup = row.state.conditionalRendering?.serialize();
  // Only serialize the conditional rendering if it has items
  if (conditionalRenderingRootGroup?.spec.items.length) {
    rowKind.spec.conditionalRendering = conditionalRenderingRootGroup;
  }

  return rowKind;
}

export function deserializeRowsLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: () => number
): RowsLayoutManager {
  if (layout.kind !== 'RowsLayout') {
    throw new Error('Invalid layout kind');
  }
  const rows = layout.spec.rows.map((row) => deserializeRow(row, elements, preload, panelIdGenerator));
  return new RowsLayoutManager({ rows });
}

export function deserializeRow(
  row: RowsLayoutRowKind,
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: () => number
): RowItem {
  const layout = row.spec.layout;

  return new RowItem({
    title: row.spec.title,
    collapse: row.spec.collapse,
    hideHeader: row.spec.hideHeader,
    fillScreen: row.spec.fillScreen,
    repeatByVariable: row.spec.repeat?.value,
    layout: layoutDeserializerRegistry.get(layout.kind).deserialize(layout, elements, preload, panelIdGenerator),
    conditionalRendering: getConditionalRendering(row),
  });
}
