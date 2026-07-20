/**
 * Shared panel serialization utilities for mutation API responses.
 *
 * Delegates to the existing layout serializers so that repeat,
 * conditional rendering, and other layout-item metadata are
 * automatically included as support for them grows.
 */

import type { VizPanel } from '@grafana/scenes';
import type { AutoGridLayoutItemKind, GridLayoutItemKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { serializeAutoGridItem } from '../../serialization/layoutSerializers/AutoGridLayoutSerializer';
import { gridItemToGridLayoutItemKind } from '../../serialization/layoutSerializers/DefaultGridLayoutSerializer';

/**
 * Serialize the current layout item for a panel by delegating to the
 * appropriate layout serializer based on the panel's parent type.
 */
export function serializeResultLayoutItem(panel: VizPanel): GridLayoutItemKind | AutoGridLayoutItemKind {
  const parent = panel.parent;

  if (parent instanceof DashboardGridItem) {
    return gridItemToGridLayoutItemKind(parent);
  }

  if (parent instanceof AutoGridItem) {
    return serializeAutoGridItem(parent);
  }

  throw new Error(`Unsupported layout item parent: ${parent?.constructor?.name ?? 'unknown'}`);
}
