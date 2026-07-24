import { type Spec as DashboardV2Spec, type RowsLayoutRowKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';
import { interpolateSectionTitle } from '../../utils/utils';

import { layoutDeserializerRegistry } from './layoutSerializerRegistry';
import { deserializeSectionVariables, serializeSectionVariables } from './sectionVariables';
import { getConditionalRendering } from './utils';

export function serializeRowsLayout(layoutManager: RowsLayoutManager, isSnapshot?: boolean): DashboardV2Spec['layout'] {
  return {
    kind: 'RowsLayout',
    spec: {
      rows: layoutManager.state.rows
        .filter((row) => !row.state.repeatSourceKey)
        .flatMap((row) => {
          // Snapshots cannot re-run the repeat on the viewer (there is no live datasource to query),
          // so materialize each repeated row clone into a concrete row with its own baked data.
          if (isSnapshot && row.state.repeatedRows?.length) {
            return [row, ...row.state.repeatedRows].map((repeatedRow) => serializeRow(repeatedRow, isSnapshot));
          }
          return [serializeRow(row, isSnapshot)];
        }),
    },
  };
}

export function serializeRow(row: RowItem, isSnapshot?: boolean): RowsLayoutRowKind {
  const layout = row.state.layout.serialize(isSnapshot);

  // A repeated row is "materialized" when it is a clone or has produced clones. When serializing a snapshot
  // of a materialized repeat we (a) bake the interpolated title — the repeat's local variable value is not
  // persisted, so otherwise it would fall back to the global value (e.g. "All") — and (b) strip the repeat
  // directive below. If the repeat hasn't been materialized (e.g. variables still loading), we leave both
  // untouched so the directive isn't silently dropped. interpolateSectionTitle matches the row renderer.
  const isMaterializedRepeat = Boolean(row.state.repeatSourceKey) || Boolean(row.state.repeatedRows?.length);
  const title = isSnapshot && isMaterializedRepeat ? interpolateSectionTitle(row, row.state.title) : row.state.title;

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
      title,
      collapse: row.state.collapse ?? false,
      layout: layout,
      fillScreen: row.state.fillScreen,
      hideHeader: row.state.hideHeader,
      // Once materialized into concrete rows for a snapshot we must not emit the repeat directive (it would
      // make the viewer re-expand and collapse back to a single row). Otherwise keep it.
      ...(row.state.repeatByVariable &&
        !(isSnapshot && isMaterializedRepeat) && {
          repeat: {
            mode: 'variable',
            value: row.state.repeatByVariable,
          },
        }),
    },
  };

  const sectionVariables = serializeSectionVariables(row.state.$variables);
  if (sectionVariables) {
    rowKind.spec.variables = sectionVariables;
  }

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
  panelIdGenerator?: PanelIdGenerator
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
  panelIdGenerator?: PanelIdGenerator
): RowItem {
  const layout = row.spec.layout;

  return new RowItem({
    title: row.spec.title,
    collapse: row.spec.collapse,
    hideHeader: row.spec.hideHeader,
    fillScreen: row.spec.fillScreen,
    repeatByVariable: row.spec.repeat?.value,
    $variables: deserializeSectionVariables(row.spec.variables),
    layout: layoutDeserializerRegistry.get(layout.kind).deserialize(layout, elements, preload, panelIdGenerator),
    conditionalRendering: getConditionalRendering(row),
  });
}
