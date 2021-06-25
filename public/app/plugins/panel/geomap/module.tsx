import { PanelPlugin } from '@grafana/data';
import { GeomapPanel } from './GeomapPanel';
import { GeomapPanelOptions } from './types';

export const plugin = new PanelPlugin<GeomapPanelOptions>(GeomapPanel)
  .setNoPadding()
  .useFieldConfig()
  .setPanelOptions((builder) => {
    let category = ['Map Controls'];
    builder
      .addBooleanSwitch({
        category,
        path: 'controls.showZoom',
        description: 'show buttons in the upper left',
        name: 'Show zoom control',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showAttribution',
        name: 'Show attribution',
        description: 'Show the map source attribution info in the lower right',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showOverview',
        name: 'Show overview map',
        description: 'Show an overview map in the lower left',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.showScale',
        name: 'Show scale',
        description: 'Indicate map scale',
        defaultValue: false,
      })
      .addBooleanSwitch({
        category,
        path: 'controls.scaleShowBar',
        name: 'Show scale as bar',
        defaultValue: false,
        showIf: (v) => v.controls.showScale,
      });
  });

// // Zoom (upper left)
// hideZoom?: boolean;

// // Lower right
// hideAttribution?: boolean;

// // Scale options
// ?: boolean;
// scaleUnits?: Units;
// scaleMinWidth?: number;
// scaleShowBar?: boolean;

// // Overview (same map for now)
// showOverview?: boolean;
