import {
  Spec as DashboardV2Spec,
  RowsLayoutRowKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowItemRepeaterBehavior } from '../../scene/layout-rows/RowItemRepeaterBehavior';
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
    },
  };

  const conditionalRenderingRootGroup = row.state.conditionalRendering?.serialize();
  // Only serialize the conditional rendering if it has items
  if (conditionalRenderingRootGroup?.spec.items.length) {
    rowKind.spec.conditionalRendering = conditionalRenderingRootGroup;
  }

  if (row.state.$behaviors) {
    for (const behavior of row.state.$behaviors) {
      if (behavior instanceof RowItemRepeaterBehavior) {
        if (rowKind.spec.repeat) {
          throw new Error('Multiple repeaters are not supported');
        }
        rowKind.spec.repeat = { value: behavior.state.variableName, mode: 'variable' };
      }
    }
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
  const $behaviors = !row.spec.repeat
    ? undefined
    : [new RowItemRepeaterBehavior({ variableName: row.spec.repeat.value })];

  return new RowItem({
    title: row.spec.title,
    collapse: row.spec.collapse,
    hideHeader: row.spec.hideHeader,
    fillScreen: row.spec.fillScreen,
    $behaviors,
    layout: layoutDeserializerRegistry.get(layout.kind).deserialize(layout, elements, preload, panelIdGenerator),
    conditionalRendering: getConditionalRendering(row),
  });
}
