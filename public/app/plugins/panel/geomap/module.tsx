import { PanelPlugin } from '@grafana/data';
import { GeomapPanel } from './GeomapPanel';
import { GeomapPanelOptions } from './types';

export const plugin = new PanelPlugin<GeomapPanelOptions>(GeomapPanel)
  .setNoPadding()
  .useFieldConfig()
  .setPanelOptions((builder) => {
    builder.addBooleanSwitch({
      category: ['Map Controls'],
      path: 'controls.hideZoom',
      name: 'Hide zoom control',
      defaultValue: false,
    });
    builder.addBooleanSwitch({
      category: ['Map Controls'],
      path: 'controls.hideAttribution',
      name: 'Hide attribution',
      defaultValue: false,
    });
  });
