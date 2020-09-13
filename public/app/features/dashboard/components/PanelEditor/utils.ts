import { CSSProperties } from 'react';
import { PanelModel } from '../../state/PanelModel';
import { DisplayMode } from './types';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT } from 'app/core/constants';
import { PanelPlugin } from '@grafana/data';

export function calculatePanelSize(mode: DisplayMode, width: number, height: number, panel: PanelModel): CSSProperties {
  if (mode === DisplayMode.Fill) {
    return { width, height };
  }
  const colWidth = (window.innerWidth - GRID_CELL_VMARGIN * 4) / GRID_COLUMN_COUNT;
  const pWidth = colWidth * panel.gridPos.w;
  const pHeight = GRID_CELL_HEIGHT * panel.gridPos.h;
  const scale = Math.min(width / pWidth, height / pHeight);

  if (mode === DisplayMode.Exact && pWidth <= width && pHeight <= height) {
    return {
      width: pWidth,
      height: pHeight,
    };
  }

  return {
    width: pWidth * scale,
    height: pHeight * scale,
  };
}

export function supportsDataQuery(plugin: PanelPlugin | undefined): boolean {
  return plugin?.meta.skipDataQuery === false;
}
