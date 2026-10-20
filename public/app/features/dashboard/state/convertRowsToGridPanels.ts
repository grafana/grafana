import { flattenDeep, isString, map, max, some } from 'lodash';

import { type GridPos, type Panel, type RowPanel } from '@grafana/schema';
import {
  DEFAULT_PANEL_SPAN,
  DEFAULT_ROW_HEIGHT,
  GRID_CELL_HEIGHT,
  GRID_CELL_VMARGIN,
  GRID_COLUMN_COUNT,
  MIN_PANEL_HEIGHT,
} from 'app/core/constants';

/** Panel of a pre-schema-version-16 dashboard, sized with `span` and pixel `height` instead of `gridPos` */
interface LegacyPanel extends Panel {
  span?: number;
  minSpan?: number;
  height?: number | string;
}

/** Row of a pre-schema-version-16 dashboard, before rows became panels of type `row` */
export interface LegacyRow {
  title?: string;
  height?: number | string;
  collapse?: boolean;
  showTitle?: boolean;
  repeat?: string;
  repeatIteration?: number;
  panels?: LegacyPanel[];
}

/**
 * Converts pre-schema-version-16 `rows` into grid positioned panels. This is the schema v16
 * migration, shared by `DashboardMigrator` and by `ResponseTransformers`, which has to handle
 * dashboards that never went through the backend migration (scripted dashboards).
 *
 * Panels inside `rows` are mutated in place (`gridPos` set, `span` dropped), and the returned
 * panels are in grid order.
 *
 * @param existingPanelIds ids already taken by top level panels, so generated row ids don't clash
 */
export function convertRowsToGridPanels(
  rows: LegacyRow[],
  existingPanelIds: Array<number | undefined> = []
): Array<Panel | RowPanel> {
  const gridPanels: Array<Panel | RowPanel> = [];

  if (!rows) {
    return gridPanels;
  }

  let yPos = 0;
  const widthFactor = GRID_COLUMN_COUNT / 12;

  const rowPanelIds = flattenDeep(map(rows, (row) => map(row.panels, 'id'))).filter((id) => id != null);
  const maxPanelId = max([...rowPanelIds, ...existingPanelIds.filter((id) => id != null)]) || 0;
  let nextRowId = maxPanelId + 1;

  // Add special "row" panels if even one row is collapsed, repeated or has visible title
  const showRows = some(rows, (row) => row.collapse || row.showTitle || row.repeat);

  for (const row of rows) {
    if (row.repeatIteration) {
      continue;
    }

    const height = row.height || DEFAULT_ROW_HEIGHT;
    const rowGridHeight = getGridHeight(height);

    let rowPanel: RowPanel | undefined;

    if (showRows) {
      rowPanel = {
        id: nextRowId,
        type: 'row',
        title: row.title,
        // left undefined when the row has no `collapse` property, so the save model matches the
        // one produced by the backend migration
        collapsed: row.collapse!,
        repeat: row.repeat,
        panels: [],
        gridPos: {
          x: 0,
          y: yPos,
          w: GRID_COLUMN_COUNT,
          h: rowGridHeight,
        },
      };
      // pushed before its panels so that the result is already in grid order
      gridPanels.push(rowPanel);
      nextRowId++;
      yPos++;
    }

    const rowArea = new RowArea(rowGridHeight, GRID_COLUMN_COUNT, yPos);

    for (const panel of row.panels ?? []) {
      panel.span = panel.span || DEFAULT_PANEL_SPAN;
      if (panel.minSpan) {
        panel.minSpan = Math.min(GRID_COLUMN_COUNT, (GRID_COLUMN_COUNT / 12) * panel.minSpan);
      }
      const panelWidth = Math.floor(panel.span) * widthFactor;
      const panelHeight = panel.height ? getGridHeight(panel.height) : rowGridHeight;

      const panelPos = rowArea.getPanelPosition(panelWidth);
      yPos = rowArea.yPos;
      panel.gridPos = {
        x: panelPos.x,
        y: yPos + panelPos.y,
        w: panelWidth,
        h: panelHeight,
      };
      rowArea.addPanel(panel.gridPos);

      delete panel.span;

      if (rowPanel?.collapsed) {
        rowPanel.panels.push(panel);
      } else {
        gridPanels.push(panel);
      }
    }

    if (!rowPanel?.collapsed) {
      yPos += rowGridHeight;
    }
  }

  return gridPanels;
}

function getGridHeight(height: number | string) {
  if (isString(height)) {
    height = parseInt(height.replace('px', ''), 10);
  }

  if (height < MIN_PANEL_HEIGHT) {
    height = MIN_PANEL_HEIGHT;
  }

  const gridHeight = Math.ceil(height / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN));
  return gridHeight;
}

/**
 * RowArea represents dashboard row filled by panels
 * area is an array of numbers represented filled column's cells like
 *  -----------------------
 * |******** ****
 * |******** ****
 * |********
 *  -----------------------
 *  33333333 2222 00000 ...
 */
class RowArea {
  area: number[];
  yPos: number;
  height: number;

  constructor(height: number, width = GRID_COLUMN_COUNT, rowYPos = 0) {
    this.area = new Array(width).fill(0);
    this.yPos = rowYPos;
    this.height = height;
  }

  reset() {
    this.area.fill(0);
  }

  /**
   * Update area after adding the panel.
   */
  addPanel(gridPos: GridPos) {
    for (let i = gridPos.x; i < gridPos.x + gridPos.w; i++) {
      if (!this.area[i] || gridPos.y + gridPos.h - this.yPos > this.area[i]) {
        this.area[i] = gridPos.y + gridPos.h - this.yPos;
      }
    }
    return this.area;
  }

  /**
   * Calculate position for the new panel in the row.
   */
  getPanelPosition(panelWidth: number, callOnce = false): { x: number; y: number } {
    let startPlace, endPlace;
    let place;
    for (let i = this.area.length - 1; i >= 0; i--) {
      if (this.height - this.area[i] > 0) {
        if (endPlace === undefined) {
          endPlace = i;
        } else {
          if (i < this.area.length - 1 && this.area[i] <= this.area[i + 1]) {
            startPlace = i;
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    if (startPlace !== undefined && endPlace !== undefined && endPlace - startPlace >= panelWidth - 1) {
      const yPos = max(this.area.slice(startPlace)) ?? 0;
      place = {
        x: startPlace,
        y: yPos,
      };
    } else if (!callOnce) {
      // wrap to next row
      this.yPos += this.height;
      this.reset();
      return this.getPanelPosition(panelWidth, true);
    } else {
      // the panel does not fit in an empty row either, put it at the start
      return { x: 0, y: 0 };
    }

    return place;
  }
}
