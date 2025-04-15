import { SceneGridItemLike, SceneGridLayout, SceneGridRow } from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

export interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NEW_PANEL_MIN_WIDTH = 8;
const NEW_PANEL_MIN_HEIGHT = 6;
const NEW_PANEL_WIDTH = 12;
const NEW_PANEL_HEIGHT = 8;

export function findSpaceForNewPanel(grid: SceneGridLayout): GridCell | null {
  // Build a grid of occupied spaces as a Set of "x,y" strings for fast lookup
  const occupied = new Set<string>();
  let maxY = 0;

  function addPanelToOccupied(panel: SceneGridItemLike) {
    for (let dx = 0; dx < panel.state.width!; dx++) {
      for (let dy = 0; dy < panel.state.height!; dy++) {
        const key = `${panel.state.x! + dx},${panel.state.y! + dy}`;
        occupied.add(key);

        if (panel.state.y! + panel.state.height! > maxY) {
          maxY = panel.state.y! + panel.state.height!;
        }
      }
    }
  }

  for (const panel of grid.state.children) {
    addPanelToOccupied(panel);

    if (panel instanceof SceneGridRow) {
      for (const rowChild of panel.state.children) {
        addPanelToOccupied(rowChild);
      }
    }
  }

  // Start scanning the grid row by row, top to bottom (infinite height)
  for (let y = 0; y < Infinity; y++) {
    for (let x = 0; x <= GRID_COLUMN_COUNT - NEW_PANEL_MIN_WIDTH; x++) {
      let fits = true;

      for (let dx = 0; dx < NEW_PANEL_MIN_WIDTH; dx++) {
        for (let dy = 0; dy < NEW_PANEL_MIN_HEIGHT; dy++) {
          const key = `${x + dx},${y + dy}`;
          if (occupied.has(key)) {
            fits = false;
            break;
          }
        }
        if (!fits) {
          break;
        }
      }

      if (fits) {
        const cell = { x, y, width: NEW_PANEL_MIN_WIDTH, height: NEW_PANEL_MIN_HEIGHT };
        return fillEmptySpace(occupied, cell, maxY);
      }
    }

    if (y > maxY + NEW_PANEL_MIN_HEIGHT) {
      break;
    }
  }

  // Should technically never reach this point
  return { x: 0, y: maxY, width: NEW_PANEL_WIDTH, height: NEW_PANEL_HEIGHT };
}

/**
 * This tries to expand the found empty space so that it fills it as much as possible
 */
function fillEmptySpace(occupied: Set<string>, cell: GridCell, maxY: number) {
  // If we are at maxY we are on a new row, return default new row panel dimensions
  if (cell.y >= maxY) {
    cell.width = NEW_PANEL_WIDTH;
    cell.height = NEW_PANEL_HEIGHT;
    return cell;
  }

  // Expand width
  for (let x = cell.x + cell.width + 1; x <= GRID_COLUMN_COUNT; x++) {
    let fits = true;

    for (let y = cell.y; y < cell.y + cell.height; y++) {
      const key = `${x},${y}`;
      if (occupied.has(key)) {
        fits = false;
        break;
      }
    }

    if (fits) {
      cell.width = x - cell.x;
    } else {
      break;
    }
  }

  // try to expand y
  for (let y = cell.y + cell.height + 1; y <= maxY; y++) {
    let fits = true;

    // Some max panel height
    if (cell.height >= 20) {
      break;
    }

    for (let x = cell.x; x < cell.x + cell.width; x++) {
      const key = `${x},${y}`;
      if (occupied.has(key)) {
        fits = false;
        break;
      }
    }

    if (fits) {
      cell.height = y - cell.y;
    } else {
      break;
    }
  }

  return cell;
}
