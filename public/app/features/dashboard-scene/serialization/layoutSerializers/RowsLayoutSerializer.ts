import { Spec as DashboardV2Spec, RowsLayoutRowKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { isClonedKey } from '../../utils/clone';

import { layoutDeserializerRegistry } from './layoutSerializerRegistry';
import { getConditionalRendering } from './utils';

export function serializeRowsLayout(layoutManager: RowsLayoutManager): DashboardV2Spec['layout'] {
  return {
    kind: 'RowsLayout',
    spec: {
      rows: layoutManager.state.rows.filter((row) => !isClonedKey(row.state.key!)).map(serializeRow),
    },
  };
}

export function serializeRow(row: RowItem): RowsLayoutRowKind {
  const layout = row.state.layout.serialize();
  const rowKind: RowsLayoutRowKind = {
    kind: 'RowsLayoutRow',
    spec: {
      title: row.state.title,
      collapse: row.state.collapse,
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
