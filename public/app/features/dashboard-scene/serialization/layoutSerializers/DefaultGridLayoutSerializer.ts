import { SceneGridItemLike, SceneGridLayout, SceneGridRow, SceneObject, VizPanel } from '@grafana/scenes';
import {
  Spec as DashboardV2Spec,
  GridLayoutItemKind,
  GridLayoutKind,
  GridLayoutRowKind,
  RepeatOptions,
  Element,
  GridLayoutItemSpec,
  PanelKind,
  LibraryPanelKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { contextSrv } from 'app/core/core';

import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../../scene/layout-default/RowRepeaterBehavior';
import { RowActions } from '../../scene/layout-default/row-actions/RowActions';
import { getOriginalKey, isClonedKey } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { calculateGridItemDimensions, isLibraryPanel } from '../../utils/utils';
import { GRID_ROW_HEIGHT } from '../const';

import { buildLibraryPanel, buildVizPanel } from './utils';

export function serializeDefaultGridLayout(
  layoutManager: DefaultGridLayoutManager,
  isSnapshot?: boolean
): DashboardV2Spec['layout'] {
  return {
    kind: 'GridLayout',
    spec: {
      items: getGridLayoutItems(layoutManager, isSnapshot),
    },
  };
}

export function deserializeDefaultGridLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: () => number
): DefaultGridLayoutManager {
  if (layout.kind !== 'GridLayout') {
    throw new Error('Invalid layout kind');
  }
  return new DefaultGridLayoutManager({
    grid: new SceneGridLayout({
      isLazy: !(preload || contextSrv.user.authenticatedBy === 'render'),
      children: createSceneGridLayoutForItems(layout, elements, panelIdGenerator),
    }),
  });
}

function getGridLayoutItems(
  body: DefaultGridLayoutManager,
  isSnapshot?: boolean
): Array<GridLayoutItemKind | GridLayoutRowKind> {
  let items: Array<GridLayoutItemKind | GridLayoutRowKind> = [];
  for (const child of body.state.grid.state.children) {
    if (child instanceof DashboardGridItem) {
      // TODO: handle panel repeater scenario
      if (child.state.variableName) {
        items = items.concat(repeaterToLayoutItems(child, isSnapshot));
      } else {
        items.push(gridItemToGridLayoutItemKind(child));
      }
    } else if (child instanceof SceneGridRow) {
      if (isClonedKey(child.state.key!) && !isSnapshot) {
        // Skip repeat rows
        continue;
      }
      items.push(gridRowToLayoutRowKind(child, isSnapshot));
    }
  }

  return items;
}

function getRowRepeat(row: SceneGridRow): RepeatOptions | undefined {
  if (row.state.$behaviors) {
    for (const behavior of row.state.$behaviors) {
      if (behavior instanceof RowRepeaterBehavior) {
        return { value: behavior.state.variableName, mode: 'variable' };
      }
    }
  }
  return undefined;
}

function gridRowToLayoutRowKind(row: SceneGridRow, isSnapshot = false): GridLayoutRowKind {
  const children = row.state.children.map((child) => {
    if (!(child instanceof DashboardGridItem)) {
      throw new Error('Unsupported row child type');
    }
    const y = (child.state.y ?? 0) - (row.state.y ?? 0) - GRID_ROW_HEIGHT;
    return gridItemToGridLayoutItemKind(child, y);
  });

  return {
    kind: 'GridLayoutRow',
    spec: {
      title: row.state.title,
      y: row.state.y ?? 0,
      collapsed: Boolean(row.state.isCollapsed),
      elements: children,
      repeat: getRowRepeat(row),
    },
  };
}

export function gridItemToGridLayoutItemKind(gridItem: DashboardGridItem, yOverride?: number): GridLayoutItemKind {
  let elementGridItem: GridLayoutItemKind | undefined;
  let x = 0,
    y = 0,
    width = 0,
    height = 0;

  let gridItem_ = gridItem;

  if (!(gridItem_.state.body instanceof VizPanel)) {
    throw new Error('DashboardGridItem body expected to be VizPanel');
  }

  // Get the grid position and size
  height = (gridItem_.state.variableName ? gridItem_.state.itemHeight : gridItem_.state.height) ?? 0;
  x = gridItem_.state.x ?? 0;
  y = gridItem_.state.y ?? 0;
  width = gridItem_.state.width ?? 0;
  const repeatVar = gridItem_.state.variableName;

  // For serialization we should retrieve the original element key
  let elementKey = dashboardSceneGraph.getElementIdentifierForVizPanel(gridItem_.state.body);

  elementGridItem = {
    kind: 'GridLayoutItem',
    spec: {
      x,
      y: yOverride ?? y,
      width: width,
      height: height,
      element: {
        kind: 'ElementReference',
        name: elementKey,
      },
    },
  };

  if (repeatVar) {
    const repeat: RepeatOptions = {
      mode: 'variable',
      value: repeatVar,
    };

    if (gridItem_.state.maxPerRow) {
      repeat.maxPerRow = gridItem_.getMaxPerRow();
    }

    if (gridItem_.state.repeatDirection) {
      repeat.direction = gridItem_.getRepeatDirection();
    }

    elementGridItem.spec.repeat = repeat;
  }

  if (!elementGridItem) {
    throw new Error('Unsupported grid item type');
  }

  return elementGridItem;
}

function repeaterToLayoutItems(repeater: DashboardGridItem, isSnapshot = false): GridLayoutItemKind[] {
  if (!isSnapshot) {
    return [gridItemToGridLayoutItemKind(repeater)];
  } else {
    if (repeater.state.body instanceof VizPanel && isLibraryPanel(repeater.state.body)) {
      // TODO: implement
      // const { x = 0, y = 0, width: w = 0, height: h = 0 } = repeater.state;
      // return [vizPanelToPanel(repeater.state.body, { x, y, w, h }, isSnapshot)];
      return [];
    }

    if (repeater.state.repeatedPanels) {
      const { h, w, columnCount } = calculateGridItemDimensions(repeater);
      const panels = repeater.state.repeatedPanels!.map((panel, index) => {
        let x = 0,
          y = 0;
        if (repeater.state.repeatDirection === 'v') {
          x = repeater.state.x!;
          y = index * h;
        } else {
          x = (index % columnCount) * w;
          y = repeater.state.y! + Math.floor(index / columnCount) * h;
        }

        const gridPos = { x, y, w, h };

        const result: GridLayoutItemKind = {
          kind: 'GridLayoutItem',
          spec: {
            x: gridPos.x,
            y: gridPos.y,
            width: gridPos.w,
            height: gridPos.h,
            repeat: {
              mode: 'variable',
              value: repeater.state.variableName!,
              maxPerRow: repeater.getMaxPerRow(),
              direction: repeater.state.repeatDirection,
            },
            element: {
              kind: 'ElementReference',
              name: panel.state.key!,
            },
          },
        };
        return result;
      });

      return panels;
    }
    return [];
  }
}

function createSceneGridLayoutForItems(
  layout: GridLayoutKind,
  elements: Record<string, Element>,
  panelIdGenerator?: () => number
): SceneGridItemLike[] {
  const gridItems = layout.spec.items;

  return gridItems.map((item) => {
    if (item.kind === 'GridLayoutItem') {
      return deserializeGridItem(item, elements, panelIdGenerator);
    } else if (item.kind === 'GridLayoutRow') {
      const children = item.spec.elements.map((gridElement) => {
        const panel = elements[getOriginalKey(gridElement.spec.element.name)];
        if (panel.kind === 'Panel' || panel.kind === 'LibraryPanel') {
          let id: number | undefined;
          if (panelIdGenerator) {
            id = panelIdGenerator();
          }
          return buildGridItem(gridElement.spec, panel, item.spec.y + GRID_ROW_HEIGHT + gridElement.spec.y, id);
        } else {
          throw new Error(`Unknown element kind: ${gridElement.kind}`);
        }
      });
      let behaviors: SceneObject[] | undefined;
      if (item.spec.repeat) {
        behaviors = [new RowRepeaterBehavior({ variableName: item.spec.repeat.value })];
      }
      return new SceneGridRow({
        y: item.spec.y,
        isCollapsed: item.spec.collapsed,
        title: item.spec.title,
        $behaviors: behaviors,
        actions: new RowActions({}),
        children,
      });
    } else {
      // If this has been validated by the schema we should never reach this point, which is why TS is telling us this is an error.
      //@ts-expect-error
      throw new Error(`Unknown layout element kind: ${item.kind}`);
    }
  });
}

function buildGridItem(
  gridItem: GridLayoutItemSpec,
  panel: PanelKind | LibraryPanelKind,
  yOverride?: number,
  id?: number
): DashboardGridItem {
  let vizPanel: VizPanel;
  if (panel.kind === 'Panel') {
    vizPanel = buildVizPanel(panel, id);
  } else {
    vizPanel = buildLibraryPanel(panel, id);
  }
  return new DashboardGridItem({
    key: `grid-item-${id ?? panel.spec.id}`,
    x: gridItem.x,
    y: yOverride ?? gridItem.y,
    width: gridItem.repeat?.direction === 'h' ? 24 : gridItem.width,
    height: gridItem.height,
    itemHeight: gridItem.height,
    body: vizPanel,
    variableName: gridItem.repeat?.value,
    repeatDirection: gridItem.repeat?.direction,
    maxPerRow: gridItem.repeat?.maxPerRow,
  });
}

export function deserializeGridItem(
  item: GridLayoutItemKind,
  elements: DashboardV2Spec['elements'],
  panelIdGenerator?: () => number
): DashboardGridItem {
  const panel = elements[item.spec.element.name];

  if (!panel) {
    throw new Error(`Panel with uid ${item.spec.element.name} not found in the dashboard elements`);
  }

  let id: number | undefined;
  if (panelIdGenerator) {
    id = panelIdGenerator();
  }
  return buildGridItem(item.spec, panel, undefined, id);
}
