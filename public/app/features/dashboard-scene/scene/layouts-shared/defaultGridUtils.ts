import { config } from '@grafana/runtime';
import {
  AutoGridLayoutKind,
  defaultAutoGridLayoutKind,
  defaultGridLayoutKind,
  GridLayoutKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

export function resetDefaultGrid(): void {
  setDefaultGrid(config.featureToggles?.dashboardNewLayouts ? 'AutoGridLayout' : 'GridLayout');
}

export function setDefaultGrid(grid: 'AutoGridLayout' | 'GridLayout'): void {
  window.sessionStorage.setItem('dashboardScene.defaultGrid', grid);
}

export function getDefaultGrid(): 'AutoGridLayout' | 'GridLayout' {
  if (!config.featureToggles?.dashboardNewLayouts) {
    setDefaultGrid('GridLayout');
    return 'GridLayout';
  }

  const grid = window.sessionStorage.getItem('dashboardScene.defaultGrid');
  if (grid === 'GridLayout' || grid === 'AutoGridLayout') {
    return grid;
  }
  setDefaultGrid('AutoGridLayout');
  return 'AutoGridLayout';
}

export function createDefaultGridLayoutManager(): AutoGridLayoutManager | DefaultGridLayoutManager {
  const defaultGrid = getDefaultGrid();
  if (defaultGrid === 'GridLayout') {
    return DefaultGridLayoutManager.fromVizPanels([]);
  }
  return AutoGridLayoutManager.createEmpty();
}

export function createDefaultGridLayoutKind(): AutoGridLayoutKind | GridLayoutKind {
  const defaultGrid = getDefaultGrid();
  if (defaultGrid === 'GridLayout') {
    return defaultGridLayoutKind();
  }
  return defaultAutoGridLayoutKind();
}
