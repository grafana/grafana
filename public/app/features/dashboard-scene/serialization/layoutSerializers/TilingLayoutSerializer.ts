import { type Spec as DashboardV2Spec, defaultAutoGridLayoutSpec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { type TilingLayoutManager } from '../../scene/layout-tiling/TilingLayoutManager';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';

/**
 * The dashboard v2 schema has no tiling layout kind yet, so only the panels are persisted, as an auto grid.
 * The tiling arrangement (docking, tabs, floating, sizes) is not saved.
 */
export function serializeTilingLayout(
  layoutManager: TilingLayoutManager,
  isSnapshot?: boolean
): DashboardV2Spec['layout'] {
  const { columnWidthMode, rowHeightMode, maxColumnCount } = defaultAutoGridLayoutSpec();

  return {
    kind: 'AutoGridLayout',
    spec: {
      maxColumnCount,
      columnWidthMode,
      rowHeightMode,
      items: layoutManager.state.panels.map((panel) => ({
        kind: 'AutoGridLayoutItem',
        spec: {
          element: {
            kind: 'ElementReference',
            name: isSnapshot
              ? dashboardSceneGraph.getSnapshotElementIdentifierForVizPanel(panel)
              : dashboardSceneGraph.getElementIdentifierForVizPanel(panel),
          },
        },
      })),
    },
  };
}
