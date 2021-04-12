import { PanelModel } from '../features/dashboard/state';
import { config } from '@grafana/runtime';

export const GRID_CELL_HEIGHT = 30;
export const GRID_CELL_VMARGIN = 8;
export const GRID_COLUMN_COUNT = 24;
export const REPEAT_DIR_VERTICAL = 'v';

export const DEFAULT_PANEL_SPAN = 4;
export const DEFAULT_ROW_HEIGHT = 250;
export const MIN_PANEL_HEIGHT = GRID_CELL_HEIGHT * 3;

export const LS_PANEL_COPY_KEY = 'panel-copy';

export const PANEL_BORDER = 2;

export const EDIT_PANEL_ID = 23763571993;

export const DEFAULT_PER_PAGE_PAGINATION = 8;

export const DEPRECATED_PANELS: Record<string, (panel: PanelModel) => string> = {
  singlestat: (panel: PanelModel) => {
    // If 'grafana-singlestat-panel' exists, move to that
    if (config.panels['grafana-singlestat-panel']) {
      return 'grafana-singlestat-panel';
    }

    // Otheriwse use gauge or stat panel
    if ((panel as any).gauge && (panel as any).gauge.show) {
      return 'gauge';
    }
    return 'stat';
  },
};
