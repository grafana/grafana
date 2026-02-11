import { config } from '@grafana/runtime';

import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

export function calculateDefaultGrid(): 'AutoGridLayout' | 'GridLayout' {
  if (config.featureToggles.dashboardNewLayouts) {
    return 'AutoGridLayout';
  }

  return 'GridLayout';
}

export function setDefaultGrid(grid: 'AutoGridLayout' | 'GridLayout'): void {
  window.sessionStorage.setItem('dashboardScene.defaultGrid', grid);
}

export function getDefaultGrid(): 'AutoGridLayout' | 'GridLayout' {
  const grid = window.sessionStorage.getItem('dashboardScene.defaultGrid');

  if (!grid || (grid !== 'GridLayout' && grid !== 'AutoGridLayout')) {
    const newGrid = calculateDefaultGrid();
    setDefaultGrid(newGrid);
    return newGrid;
  }

  return grid;
}

export function createDefaultGridLayoutManager(
  defaultGrid = getDefaultGrid()
): AutoGridLayoutManager | DefaultGridLayoutManager {
  if (defaultGrid === 'GridLayout') {
    return DefaultGridLayoutManager.fromVizPanels([]);
  }
  return AutoGridLayoutManager.createEmpty();
}
